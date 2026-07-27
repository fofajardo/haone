import type { PaymentRequestServiceInterface } from "../interfaces/payment-request-service.interface";
import type {
  PaymentRequestRecord,
  JournalRecord,
  PaginationOptions,
  PaginatedResponse
} from "$lib/types";
import { PaymentRequestStatus } from "$lib/types";
import { supabase } from "../common";
import { isUuid } from "$utils/parsers";

export const supabasePaymentRequestService: PaymentRequestServiceInterface = {
  async fetchPaymentRequests(
    residentId?: string,
    options?: PaginationOptions
  ): Promise<PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord>> {
    if (!supabase) {
      return [];
    }

    let query = supabase.from("payment_requests").select("*", { count: "exact" });

    if (residentId && isUuid(residentId)) {
      query = query.eq("resident_id", residentId);
    }

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize - 1;
      query = query.range(start, end);
    }

    const [pmtRes, usersRes] = await Promise.all([
      query,
      supabase.from("users_view").select("id, display_name")
    ]);

    const { data, count, error } = pmtRes;
    if (error) {
      throw error;
    }

    const userMap = new Map<string, string>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id, u.display_name || "");
      }
    });

    const items: PaymentRequestRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      residentId: row.resident_id,
      date: row.date,
      waterFee: row.water_fee,
      assocFee: row.assoc_fee,
      misc: row.misc,
      mop: row.mop,
      type: row.type,
      proofLink: row.proof_link,
      status: row.status,
      notes: row.notes,
      statusReason: row.status_reason,
      name: userMap.get(row.resident_id) || "",
      raw: row
    }));

    if (options?.page && options?.pageSize) {
      const totalCount = count || 0;
      return {
        items,
        totalCount,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(totalCount / options.pageSize)
      };
    }

    return items;
  },

  async addPaymentRequest(data: Partial<PaymentRequestRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("payment_requests").insert({
      resident_id: data.residentId,
      date: data.date,
      water_fee: data.waterFee,
      assoc_fee: data.assocFee,
      misc: data.misc,
      mop: data.mop,
      type: data.type,
      proof_link: data.proofLink,
      status: data.status || PaymentRequestStatus.PENDING,
      notes: data.notes,
      status_reason: data.statusReason
    });
    if (error) {
      throw error;
    }
  },

  async approvePaymentRequest(
    paymentId: string,
    journalData: Partial<JournalRecord>
  ): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: PaymentRequestStatus.APPROVED })
      .eq("id", paymentId);
    if (error) {
      throw error;
    }

    const { error: jError } = await supabase.from("journal").insert({
      date: journalData.date,
      creator_email: journalData.creator,
      account_email: journalData.account,
      water: journalData.water,
      assoc: journalData.assoc,
      misc: journalData.misc,
      mop: journalData.mop,
      period: journalData.period,
      type: journalData.type,
      notes: journalData.notes,
      notes_private: journalData.notesPrivate,
      mop_ref_no: journalData.mopRefNo,
      pr_date_issued: journalData.prDateIssued,
      pr_ref_no: journalData.prRefNo,
      was_audited: journalData.wasAudited,
      receipt_url: journalData.receiptUrl
    });

    if (jError) {
      throw jError;
    }
  },

  async declinePaymentRequest(paymentId: string, reason: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("payment_requests")
      .update({
        status: PaymentRequestStatus.DECLINED,
        status_reason: reason
      })
      .eq("id", paymentId);
    if (error) {
      throw error;
    }
  },

  async cancelPaymentRequest(paymentId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: PaymentRequestStatus.CANCELLED })
      .eq("id", paymentId);
    if (error) {
      throw error;
    }
  }
};
