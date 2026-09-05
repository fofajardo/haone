import type {
  RoomsServiceInterface,
  CurrRecord,
  AccountRow,
  AccountUpdate
} from "../interfaces/rooms-service.interface";
import {
  supabase,
  handleSupabaseError,
  assertSupabaseFound,
  fetchAllSupabaseRows
} from "../common";
import { parseDbDate, parseDbUuid } from "$utils/parsers";

function mapAccountRow(row: any): AccountRow {
  return {
    id: row.id || "",
    residentId: row.resident_id || "",
    period: row.period || "",
    room: row.room || "",
    bed: row.bed || "",
    ceRefNo: row.ce_ref_no || "",
    ceIssued: row.ce_issued || "",
    ceLink: row.ce_link || "",
    accountNotes: row.account_notes || "",
    issuerId: row.issuer_id || "",
    checkInDate: row.check_in_date || "",
    type: row.type || ""
  };
}

export const supabaseRoomsService: RoomsServiceInterface = {
  async fetchCurrRecords(_bypassCache = false): Promise<CurrRecord[]> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;
    const data = await fetchAllSupabaseRows(() =>
      sb
        .from("curr")
        .select("*")
        .order("timestamp", { ascending: true })
        .order("id", { ascending: true })
    );
    return data.map((row: any, idx: number) => ({
      timestamp: row.timestamp || "",
      email: (row.email || "").trim().toLowerCase(),
      room: (row.room || "").trim(),
      bed: (row.bed || "").trim(),
      program: (row.program || "").trim(),
      studentNo: (row.student_no || "").trim(),
      checkInDate: row.check_in_date || "",
      lastName: (row.last_name || "").trim().toUpperCase(),
      firstName: (row.first_name || "").trim().toUpperCase(),
      college: (row.college || "").trim(),
      isEvaluated: row.evaluated ?? false,
      term: (row.term || "").trim(),
      accountType: (row.account_type || "").trim().toUpperCase(),
      suffix: (row.suffix || "").trim().toUpperCase(),
      overrideName: (row.override_name || "").trim(),
      declineReason: (row.decline_reason || row.declination_reason || "").trim(),
      rowIndex: idx + 2,
      raw: row
    }));
  },

  async fetchAccounts(_bypassCache = false): Promise<AccountRow[]> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;
    const data = await fetchAllSupabaseRows(() =>
      sb
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    );
    return data.map(mapAccountRow);
  },

  async updateAccounts(updates: AccountUpdate[]): Promise<void> {
    if (!supabase) {
      return;
    }
    for (const update of updates) {
      const payload: Record<string, any> = {};
      if (update.room !== undefined) {
        payload.room = update.room;
      }
      if (update.bed !== undefined) {
        payload.bed = update.bed;
      }
      if (update.checkInDate !== undefined) {
        payload.check_in_date = parseDbDate(update.checkInDate);
      }
      if (Object.keys(payload).length === 0) {
        continue;
      }
      const { data, error } = await supabase
        .from("accounts")
        .update(payload)
        .eq("id", update.id)
        .select("id");
      if (error) {
        handleSupabaseError(error);
      }
      assertSupabaseFound(data, "Account record not found.");
    }
  },

  async appendAccounts(accounts: AccountRow[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const formatted = accounts.map((a) => ({
      id: a.id || crypto.randomUUID(),
      resident_id: parseDbUuid(a.residentId),
      period: a.period,
      room: a.room,
      bed: a.bed,
      ce_ref_no: a.ceRefNo,
      ce_issued: parseDbDate(a.ceIssued),
      ce_link: a.ceLink,
      account_notes: a.accountNotes,
      issuer_id: parseDbUuid(a.issuerId),
      check_in_date: parseDbDate(a.checkInDate),
      type: a.type || ""
    }));
    const { error } = await supabase.from("accounts").insert(formatted);
    if (error) {
      handleSupabaseError(error);
    }
  },

  async markCurrEvaluated(
    entries: { email: string; term: string; rowId?: string | number }[]
  ): Promise<void> {
    if (!supabase) {
      return;
    }
    for (const entry of entries) {
      let query = supabase.from("curr").update({ evaluated: true });
      if (entry.rowId !== undefined && typeof entry.rowId === "string") {
        query = query.eq("id", entry.rowId);
      } else {
        query = query
          .ilike("email", entry.email.trim())
          .eq("term", entry.term)
          .eq("evaluated", false);
      }
      const { error } = await query;
      if (error) {
        handleSupabaseError(error);
      }
    }
  },

  async declineCurrRecord(
    email: string,
    term: string,
    reason: string,
    rowId?: string | number
  ): Promise<void> {
    if (!supabase) {
      return;
    }
    let query = supabase.from("curr").update({ evaluated: true, decline_reason: reason });
    if (rowId !== undefined && typeof rowId === "string") {
      query = query.eq("id", rowId);
    } else {
      query = query.ilike("email", email.trim()).eq("term", term).eq("evaluated", false);
    }
    const { error } = await query;
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateAccountRoomBed(
    residentId: string,
    period: string,
    room: string,
    bed: string
  ): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .update({ room, bed })
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Account record not found.");
  },

  async addAccount(account: AccountRow): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("accounts").insert({
      id: account.id || crypto.randomUUID(),
      resident_id: parseDbUuid(account.residentId),
      period: account.period,
      room: account.room,
      bed: account.bed,
      ce_ref_no: account.ceRefNo,
      ce_issued: parseDbDate(account.ceIssued),
      ce_link: account.ceLink,
      account_notes: account.accountNotes,
      issuer_id: parseDbUuid(account.issuerId),
      check_in_date: parseDbDate(account.checkInDate),
      type: account.type || ""
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async deleteAccountRow(residentId: string, period: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .delete()
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Account record not found.");
  },

  async updateAccountBed(residentId: string, period: string, bed: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .update({ bed })
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Account record not found.");
  }
};
