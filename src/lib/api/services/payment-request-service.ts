import type {
  JournalRecord,
  PaginatedResponse,
  PaginationOptions,
  PaymentRequestRecord
} from "$lib/types";
import { PaymentRequestStatus } from "$lib/types";
import { isUuid } from "$utils/parsers";
import { assertSupabaseFound, fetchAllSupabaseRows, handleSupabaseError, supabase } from "./common";
import { buildJournalInsertPayload, syncAcknowledgmentReceipt } from "./journal-service";

export interface PaymentRequestServiceInterface {
  fetchPaymentRequests(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord>>;

  addPaymentRequest(data: Partial<PaymentRequestRecord>): Promise<void>;

  approvePaymentRequest(paymentId: string, journalData: Partial<JournalRecord>): Promise<void>;

  declinePaymentRequest(paymentId: string, reason: string): Promise<void>;

  cancelPaymentRequest(id: string): Promise<void>;
}

function emptyResult(
  options?: PaginationOptions
): PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord> {
  if (options?.page && options?.pageSize) {
    return {
      items: [],
      totalCount: 0,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: 0
    };
  }
  return [];
}

export const paymentRequestService: PaymentRequestServiceInterface = {
  async fetchPaymentRequests(
    residentId?: string,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord>> {
    if (!supabase) {
      return [];
    }

    if (residentId && !isUuid(residentId)) {
      return emptyResult(options);
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      let query = supabase.from("payment_requests").select("*", { count: "exact" });
      if (residentId) {
        query = query.eq("resident_id", residentId);
      }
      query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize! - 1;
      const { data: rows, count: total, error } = await query.range(start, end);
      if (error) {
        handleSupabaseError(error);
      }
      data = rows || [];
      count = total || 0;
    } else {
      const sb = supabase;
      data = await fetchAllSupabaseRows(() => {
        let query = sb.from("payment_requests").select("*");
        if (residentId) {
          query = query.eq("resident_id", residentId);
        }
        return query.order("created_at", { ascending: true }).order("id", { ascending: true });
      });
    }

    const usersRes = await supabase.from("users_view").select("id, display_name");
    if (usersRes.error) {
      handleSupabaseError(usersRes.error);
    }

    const userMap = new Map<string, string>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id, u.display_name || "");
      }
    });

    const items: PaymentRequestRecord[] = data.map((row: any) => ({
      id: row.id,
      residentId: row.resident_id,
      date: row.date,
      waterFee: row.water_fee ?? 0,
      assocFee: row.assoc_fee ?? 0,
      misc: row.misc ?? 0,
      mop: row.mop || "",
      type: row.type || "",
      proofLink: row.proof_link || "",
      status: (row.status || PaymentRequestStatus.PENDING).trim().toUpperCase(),
      notes: row.notes || "",
      statusReason: row.status_reason || "",
      name: userMap.get(row.resident_id) || "",
      raw: row
    }));

    if (isPaginated) {
      return {
        items,
        totalCount: count,
        page: options!.page!,
        pageSize: options!.pageSize!,
        totalPages: Math.ceil(count / options!.pageSize!)
      };
    }

    return items;
  },

  async addPaymentRequest(data: Partial<PaymentRequestRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("payment_requests").insert({
      id: data.id || crypto.randomUUID(),
      resident_id: data.residentId,
      date: data.date,
      water_fee: data.waterFee ?? 0,
      assoc_fee: data.assocFee ?? 0,
      misc: data.misc ?? 0,
      mop: data.mop,
      type: data.type,
      proof_link: data.proofLink,
      status: data.status || PaymentRequestStatus.PENDING,
      notes: data.notes,
      status_reason: data.statusReason
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async approvePaymentRequest(
    paymentId: string,
    journalData: Partial<JournalRecord>
  ): Promise<void> {
    if (!supabase) {
      return;
    }

    const { data: approved, error } = await supabase
      .from("payment_requests")
      .update({ status: PaymentRequestStatus.APPROVED })
      .eq("id", paymentId)
      .eq("status", PaymentRequestStatus.PENDING)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(approved, "Payment record not found or is no longer pending");

    const { groupRow, itemRows } = buildJournalInsertPayload(
      journalData,
      journalData.creatorId && isUuid(journalData.creatorId) ? journalData.creatorId : null,
      journalData.accountId && isUuid(journalData.accountId) ? journalData.accountId : null
    );

    const { error: gError } = await supabase.from("journal_groups").insert(groupRow);
    if (gError) {
      await supabase
        .from("payment_requests")
        .update({ status: PaymentRequestStatus.PENDING })
        .eq("id", paymentId);
      handleSupabaseError(gError);
    }

    const { error: jError } = await supabase.from("journal").insert(itemRows);
    if (jError) {
      await supabase.from("journal_groups").delete().eq("id", groupRow.id);
      await supabase
        .from("payment_requests")
        .update({ status: PaymentRequestStatus.PENDING })
        .eq("id", paymentId);
      handleSupabaseError(jError);
    }

    await syncAcknowledgmentReceipt(groupRow.id, journalData);
  },

  async declinePaymentRequest(paymentId: string, reason: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("payment_requests")
      .update({
        status: PaymentRequestStatus.DECLINED,
        status_reason: reason
      })
      .eq("id", paymentId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Payment record not found");
  },

  async cancelPaymentRequest(paymentId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("payment_requests")
      .update({ status: PaymentRequestStatus.CANCELLED })
      .eq("id", paymentId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Payment request not found");
  }
};
