import type { LaundryServiceInterface } from "../interfaces/laundry-service.interface";
import type { LaundryRecord, PaginationOptions, PaginatedResponse } from "$lib/types";
import { LaundryStatus } from "$lib/types";
import {
  supabase,
  handleSupabaseError,
  assertSupabaseFound,
  fetchAllSupabaseRows
} from "../common";
import { isUuid, parseDbUuid, parseTimeMinutes } from "$utils/parsers";
import { formatTime } from "$utils/formatters";
import { auth } from "$state/auth.svelte";
import { canAccessLaundry } from "$api/controllers/resident-controller";

const INACTIVE_STATUSES = [LaundryStatus.CANCELLED_BY_ADMIN, LaundryStatus.CANCELLED_BY_USER];

function emptyResult(
  options?: PaginationOptions
): LaundryRecord[] | PaginatedResponse<LaundryRecord> {
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

export const supabaseLaundryService: LaundryServiceInterface = {
  async fetchReservations(
    residentId?: string,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>> {
    if (!supabase) {
      return [];
    }

    if (residentId && !isUuid(residentId)) {
      // A non-UUID id can never match; Sheets' equality filter yields nothing.
      return emptyResult(options);
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      let query = supabase.from("laundry").select("*", { count: "exact" });
      if (residentId) {
        query = query.eq("resident_id", residentId);
      }
      query = query
        .order("date", { ascending: true })
        .order("time_start", { ascending: true })
        .order("id", { ascending: true });
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
        let query = sb.from("laundry").select("*");
        if (residentId) {
          query = query.eq("resident_id", residentId);
        }
        return query
          .order("date", { ascending: true })
          .order("time_start", { ascending: true })
          .order("id", { ascending: true });
      });
    }

    const items: LaundryRecord[] = data.map((row: any) => ({
      id: row.id,
      residentId: row.resident_id,
      date: row.date,
      timeStart: row.time_start,
      timeEnd: row.time_end,
      status: (row.status || LaundryStatus.ACTIVE).trim(),
      cancelReason: row.cancel_reason || "",
      creationTimestamp: row.created_at,
      cancelTimestamp: row.cancelled_at || "",
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

  async addReservation(data: Partial<LaundryRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    // Resident bookings go through the same validation the Sheets server route
    // enforces (RLS cannot express these business rules). Admin bookings are
    // exempt, mirroring the Sheets behavior.
    if (auth.isResident) {
      const residentUuid = parseDbUuid(data.residentId);
      if (!residentUuid) {
        throw new Error("Reservation not found or unauthorized");
      }

      const { data: constData } = await supabase
        .from("constants")
        .select("value")
        .eq("key", "TERM_CURR")
        .maybeSingle();
      const activeTerm = constData?.value || "";

      const { data: account } = await supabase
        .from("accounts")
        .select("type")
        .eq("resident_id", residentUuid)
        .eq("period", activeTerm)
        .maybeSingle();
      const accountType = (account?.type || "STUDENT").toUpperCase();

      if (!canAccessLaundry(accountType)) {
        throw new Error("Access Denied: Account type cannot book laundry");
      }

      const { date, timeStart, timeEnd } = data;
      if (!date || !timeStart || !timeEnd) {
        throw new Error("Date, Start Time, and End Time are required");
      }

      const startMinutes = parseTimeMinutes(timeStart);
      const endMinutes = parseTimeMinutes(timeEnd);
      if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
        throw new Error("End time must be after start time");
      }
      if (endMinutes - startMinutes > 180) {
        throw new Error("Reservations cannot exceed 3 hours");
      }

      const { data: existingRows, error: fetchError } = await supabase
        .from("laundry")
        .select("resident_id, date, time_start, time_end, status")
        .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`);
      if (fetchError) {
        handleSupabaseError(fetchError);
      }

      const activeReservations = existingRows || [];
      const activeUserCount = activeReservations.filter(
        (r: any) => r.resident_id === residentUuid
      ).length;
      if (activeUserCount >= 2) {
        throw new Error("Limit Exceeded: You can only have 2 active reservations at a time");
      }

      // NOTE: under RLS a resident only sees their own rows, so cross-resident
      // slot clashes cannot be detected client-side. The check below still
      // catches self-overlap; full clash detection requires an officer or an RPC.
      for (const res of activeReservations) {
        if (res.date !== date) {
          continue;
        }
        const exStart = parseTimeMinutes(res.time_start);
        const exEnd = parseTimeMinutes(res.time_end);
        if (!isNaN(exStart) && !isNaN(exEnd)) {
          if (startMinutes < exEnd && endMinutes > exStart) {
            throw new Error(
              `Slot Unavailable: Clashes with reservation from ${formatTime(res.time_start)} to ${formatTime(res.time_end)}`
            );
          }
        }
      }
    }

    const { error } = await supabase.from("laundry").insert({
      id: data.id || crypto.randomUUID(),
      resident_id: parseDbUuid(data.residentId),
      date: data.date,
      time_start: data.timeStart,
      time_end: data.timeEnd,
      status: data.status || LaundryStatus.ACTIVE,
      cancel_reason: data.cancelReason
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async addReservationsBatch(records: Partial<LaundryRecord>[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const rows = records.map((r) => ({
      id: r.id || crypto.randomUUID(),
      resident_id: parseDbUuid(r.residentId),
      date: r.date,
      time_start: r.timeStart,
      time_end: r.timeEnd,
      status: r.status || LaundryStatus.ACTIVE,
      cancel_reason: r.cancelReason
    }));
    const { error } = await supabase.from("laundry").insert(rows);
    if (error) {
      handleSupabaseError(error);
    }
  },

  async cancelReservation(id: string, reason: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("laundry")
      .update({
        status: auth.isResident
          ? LaundryStatus.CANCELLED_BY_USER
          : LaundryStatus.CANCELLED_BY_ADMIN,
        cancel_reason: reason,
        cancelled_at: now
      })
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Reservation not found");
  }
};
