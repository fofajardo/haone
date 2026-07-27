import type {
  JournalServiceInterface,
  JournalFilters
} from "../interfaces/journal-service.interface";
import type { JournalRecord, PaginationOptions, PaginatedResponse } from "$lib/types";
import { supabase } from "../common";
import { parseCSVAmount } from "$utils/math";
import { parseDbDate } from "$utils/parsers";

export const supabaseJournalService: JournalServiceInterface = {
  async fetchJournalEntries(
    _filters?: JournalFilters,
    options?: PaginationOptions
  ): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>> {
    if (!supabase) {
      return [];
    }

    let query = supabase.from("journal").select("*", { count: "exact" });

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize - 1;
      query = query.range(start, end);
    }

    const [journalRes, usersRes] = await Promise.all([
      query,
      supabase.from("users_view").select("id, email, display_name, student_no")
    ]);

    const { data, count, error } = journalRes;
    if (error) {
      throw error;
    }

    const userMap = new Map<string, any>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.email) {
        userMap.set(u.email.toLowerCase().trim(), u);
      }
    });

    const items: JournalRecord[] = (data || []).map((row: any) => {
      const accountEmail = (row.account_email || "").toLowerCase().trim();
      const creatorEmail = (row.creator_email || "").toLowerCase().trim();
      const accountUser = userMap.get(accountEmail);
      const creatorUser = userMap.get(creatorEmail);

      return {
        id: row.id,
        date: row.date,
        creator: row.creator_email || "",
        account: row.account_email || "",
        water: parseCSVAmount(row.water),
        assoc: parseCSVAmount(row.assoc),
        misc: parseCSVAmount(row.misc),
        amount: parseCSVAmount(row.water) + parseCSVAmount(row.assoc) + parseCSVAmount(row.misc),
        mop: row.mop || "",
        period: row.period || "",
        type: row.type || "",
        notes: row.notes || "",
        notesPrivate: row.notes_private || "",
        mopRefNo: row.mop_ref_no || "",
        prDateIssued: row.pr_date_issued || "",
        prRefNo: row.pr_ref_no || "",
        creatorName: creatorUser?.display_name || "",
        name: accountUser?.display_name || "",
        stno: accountUser?.student_no || "",
        wasAudited: row.was_audited || false,
        receiptUrl: row.receipt_url || "",
        raw: row
      };
    });

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

  async addJournalEntry(data: Partial<JournalRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("journal").insert({
      date: parseDbDate(data.date) || new Date().toISOString().split("T")[0],
      creator_email: data.creator,
      account_email: data.account,
      water: data.water,
      assoc: data.assoc,
      misc: data.misc,
      mop: data.mop,
      period: data.period,
      type: data.type,
      notes: data.notes,
      notes_private: data.notesPrivate,
      mop_ref_no: data.mopRefNo,
      pr_date_issued: parseDbDate(data.prDateIssued),
      pr_ref_no: data.prRefNo,
      was_audited: data.wasAudited,
      receipt_url: data.receiptUrl
    });
    if (error) {
      throw error;
    }
  },

  async updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    const payload: Record<string, any> = {};
    if (data.date !== undefined) {
      payload.date = parseDbDate(data.date);
    }
    if (data.creator !== undefined) {
      payload.creator_email = data.creator;
    }
    if (data.account !== undefined) {
      payload.account_email = data.account;
    }
    if (data.water !== undefined) {
      payload.water = data.water;
    }
    if (data.assoc !== undefined) {
      payload.assoc = data.assoc;
    }
    if (data.misc !== undefined) {
      payload.misc = data.misc;
    }
    if (data.mop !== undefined) {
      payload.mop = data.mop;
    }
    if (data.period !== undefined) {
      payload.period = data.period;
    }
    if (data.type !== undefined) {
      payload.type = data.type;
    }
    if (data.notes !== undefined) {
      payload.notes = data.notes;
    }
    if (data.notesPrivate !== undefined) {
      payload.notes_private = data.notesPrivate;
    }
    if (data.mopRefNo !== undefined) {
      payload.mop_ref_no = data.mopRefNo;
    }
    if (data.prDateIssued !== undefined) {
      payload.pr_date_issued = parseDbDate(data.prDateIssued);
    }
    if (data.prRefNo !== undefined) {
      payload.pr_ref_no = data.prRefNo;
    }
    if (data.wasAudited !== undefined) {
      payload.was_audited = data.wasAudited;
    }
    if (data.receiptUrl !== undefined) {
      payload.receipt_url = data.receiptUrl;
    }

    const { error } = await supabase.from("journal").update(payload).eq("id", id);
    if (error) {
      throw error;
    }
  },

  async deleteJournalEntry(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("journal").delete().eq("id", id);
    if (error) {
      throw error;
    }
  },

  async batchAuditEntries(ids: string[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("journal").update({ was_audited: true }).in("id", ids);
    if (error) {
      throw error;
    }
  }
};
