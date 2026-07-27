import type { LaundryServiceInterface } from "../interfaces/laundry-service.interface";
import type { LaundryRecord, PaginationOptions, PaginatedResponse } from "$lib/types";
import { supabase } from "../common";
import { isUuid, parseDbUuid } from "$utils/parsers";

export const supabaseLaundryService: LaundryServiceInterface = {
  async fetchReservations(
    residentId?: string,
    options?: PaginationOptions
  ): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>> {
    if (!supabase) {
      return [];
    }

    let query = supabase.from("laundry").select("*", { count: "exact" });

    if (residentId && isUuid(residentId)) {
      query = query.eq("resident_id", residentId);
    }

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize - 1;
      query = query.range(start, end);
    }

    const { data, count, error } = await query;
    if (error) {
      throw error;
    }

    const items: LaundryRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      residentId: row.resident_id,
      date: row.date,
      timeStart: row.time_start,
      timeEnd: row.time_end,
      status: row.status,
      cancelReason: row.cancel_reason,
      creationTimestamp: row.created_at,
      cancelTimestamp: row.cancelled_at,
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

  async addReservation(data: Partial<LaundryRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("laundry").insert({
      resident_id: parseDbUuid(data.residentId),
      date: data.date,
      time_start: data.timeStart,
      time_end: data.timeEnd,
      status: data.status || "ACTIVE",
      cancel_reason: data.cancelReason
    });
    if (error) {
      throw error;
    }
  },

  async addReservationsBatch(records: Partial<LaundryRecord>[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const rows = records.map((r) => ({
      resident_id: parseDbUuid(r.residentId),
      date: r.date,
      time_start: r.timeStart,
      time_end: r.timeEnd,
      status: r.status || "ACTIVE",
      cancel_reason: r.cancelReason
    }));
    const { error } = await supabase.from("laundry").insert(rows);
    if (error) {
      throw error;
    }
  },

  async cancelReservation(id: string, reason: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("laundry")
      .update({
        status: "CANCELLED",
        cancel_reason: reason,
        cancelled_at: now
      })
      .eq("id", id);
    if (error) {
      throw error;
    }
  }
};
