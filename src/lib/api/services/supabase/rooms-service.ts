import type { RoomsServiceInterface, CurrRecord } from "../interfaces/rooms-service.interface";
import { supabase } from "../common";
import { parseDbDate, parseDbUuid } from "$utils/parsers";

export const supabaseRoomsService: RoomsServiceInterface = {
  async fetchCurrRecords(_forceRefresh = false): Promise<CurrRecord[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("curr").select("*");
    if (error) {
      throw error;
    }
    return (data || []).map((row: any, idx: number) => ({
      timestamp: row.timestamp || "",
      email: row.email || "",
      room: row.room || "",
      bed: row.bed || "",
      program: row.program || "",
      studentNo: row.student_no || "",
      checkInDate: row.check_in_date || "",
      lastName: row.last_name || "",
      firstName: row.first_name || "",
      college: row.college || "",
      isEvaluated: row.evaluated ?? false,
      term: row.term || "",
      accountType: row.account_type || "STUDENT",
      suffix: row.suffix || "",
      overrideName: row.override_name || "",
      rowIndex: idx + 2,
      raw: row
    })) as CurrRecord[];
  },

  async fetchAccountsRaw(_forceRefresh = false): Promise<any[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("accounts").select("*");
    if (error) {
      throw error;
    }
    return (data || []) as any[];
  },

  async batchUpdateAccounts(updates: { range: string; values: any[][] }[]): Promise<void> {
    if (!supabase) {
      return;
    }
    for (const update of updates) {
      // Parse range if needed or update via query
    }
  },

  async appendAccounts(rows: any[][]): Promise<void> {
    if (!supabase) {
      return;
    }

    const formatted = rows.map((r) => ({
      id: r[0] || crypto.randomUUID(),
      resident_id: r[1],
      period: r[2],
      room: r[3],
      bed: r[4],
      ce_ref_no: r[5],
      ce_issued: parseDbDate(r[6]),
      ce_link: r[7],
      account_notes: r[8],
      issuer_id: parseDbUuid(r[9]),
      check_in_date: parseDbDate(r[10]),
      type: r[11] || "STUDENT"
    }));
    const { error } = await supabase.from("accounts").insert(formatted);
    if (error) {
      throw error;
    }
  },

  async batchUpdateCurr(_updates: { range: string; values: any[][] }[]): Promise<void> {
    if (!supabase) {
      return;
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
    const { error } = await supabase
      .from("accounts")
      .update({ room, bed })
      .eq("resident_id", residentId)
      .eq("period", period);
    if (error) {
      throw error;
    }
  },

  async addAccountRow(row: any[]): Promise<void> {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("accounts").insert({
      id: row[0] || crypto.randomUUID(),
      resident_id: row[1],
      period: row[2],
      room: row[3],
      bed: row[4],
      ce_ref_no: row[5],
      ce_issued: parseDbDate(row[6]),
      ce_link: row[7],
      account_notes: row[8],
      issuer_id: parseDbUuid(row[9]),
      check_in_date: parseDbDate(row[10]),
      type: row[11] || "STUDENT"
    });
    if (error) {
      throw error;
    }
  },

  async deleteAccountRow(residentId: string, period: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("resident_id", residentId)
      .eq("period", period);
    if (error) {
      throw error;
    }
  },

  async updateAccountCheckInDate(residentId: string, period: string, date: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("accounts")
      .update({ check_in_date: date })
      .eq("resident_id", residentId)
      .eq("period", period);
    if (error) {
      throw error;
    }
  },

  async fetchStaticIpRows(): Promise<any[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("static_ip").select("*");
    if (error) {
      throw error;
    }
    return (data || []) as any[];
  },

  async appendStaticIpRows(rows: any[][]): Promise<void> {
    if (!supabase) {
      return;
    }
    const formatted = rows.map((r) => ({
      id: r[0] || crypto.randomUUID(),
      recorder_id: r[1],
      resident_id: r[2],
      period: r[3],
      type: r[4],
      ip: r[5],
      notes: r[6]
    }));
    const { error } = await supabase.from("static_ip").insert(formatted);
    if (error) {
      throw error;
    }
  }
};
