import type { FridgeItemRecord, PaginatedResponse, PaginationOptions } from "$lib/types";
import { FridgeCompartment, FridgeItemStatus } from "$lib/types";
import { isUuid, parseDbUuid } from "$utils/parsers";
import { fetchAllSupabaseRows, handleSupabaseError, supabase } from "../common";
import type { FridgeServiceInterface } from "../interfaces/fridge-service.interface";

function emptyResult(
  options?: PaginationOptions
): FridgeItemRecord[] | PaginatedResponse<FridgeItemRecord> {
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

export const supabaseFridgeService: FridgeServiceInterface = {
  async fetchFridgeItems(
    residentId?: string,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<FridgeItemRecord[] | PaginatedResponse<FridgeItemRecord>> {
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
      let query = supabase.from("fridge_items").select("*", { count: "exact" });
      if (residentId) {
        query = query.eq("resident_id", residentId);
      }
      query = query
        .order("date_stored", { ascending: false })
        .order("created_at", { ascending: false });
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize! - 1;
      query = query.range(start, end);

      const { data: pageData, count: totalCount, error } = await query;
      if (error) {
        handleSupabaseError(error);
      }
      data = pageData || [];
      count = totalCount || 0;
    } else {
      const sb = supabase;
      data = await fetchAllSupabaseRows(() => {
        let query = sb.from("fridge_items").select("*");
        if (residentId) {
          query = query.eq("resident_id", residentId);
        }
        return query.order("date_stored", { ascending: false });
      });
      count = data.length;
    }

    const mapped: FridgeItemRecord[] = data.map((d: any) => ({
      id: d.id,
      residentId: d.resident_id,
      name: d.name || "",
      compartment: d.compartment || FridgeCompartment.REFRIGERATOR,
      locationDetails: d.location_details || "",
      dateStored: d.date_stored || "",
      expiryDate: d.expiry_date || "",
      photoUrl: d.photo_url || "",
      status: d.status || FridgeItemStatus.STORED,
      notes: d.notes || "",
      checkOutDate: d.check_out_date || "",
      actionBy: d.action_by || "",
      raw: []
    }));

    if (isPaginated) {
      return {
        items: mapped,
        totalCount: count,
        page: options!.page!,
        pageSize: options!.pageSize!,
        totalPages: Math.ceil(count / options!.pageSize!)
      };
    }

    return mapped;
  },

  async addFridgeItem(data: Partial<FridgeItemRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const residentId = parseDbUuid(data.residentId);
    if (!residentId) {
      throw new Error("Invalid resident ID");
    }

    const { error } = await supabase.from("fridge_items").insert({
      id: data.id || crypto.randomUUID(),
      resident_id: residentId,
      name: data.name || "",
      compartment: data.compartment || FridgeCompartment.REFRIGERATOR,
      location_details: data.locationDetails || "",
      date_stored: data.dateStored || new Date().toISOString().split("T")[0],
      expiry_date: data.expiryDate || null,
      photo_url: data.photoUrl || null,
      status: data.status || FridgeItemStatus.STORED,
      notes: data.notes || "",
      check_out_date: data.checkOutDate || null,
      action_by: data.actionBy || null
    });

    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateFridgeItem(id: string, updates: Partial<FridgeItemRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.compartment !== undefined) payload.compartment = updates.compartment;
    if (updates.locationDetails !== undefined) payload.location_details = updates.locationDetails;
    if (updates.dateStored !== undefined) payload.date_stored = updates.dateStored;
    if (updates.expiryDate !== undefined) payload.expiry_date = updates.expiryDate || null;
    if (updates.photoUrl !== undefined) payload.photo_url = updates.photoUrl || null;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.checkOutDate !== undefined) payload.check_out_date = updates.checkOutDate || null;
    if (updates.actionBy !== undefined) payload.action_by = updates.actionBy || null;

    const { error } = await supabase.from("fridge_items").update(payload).eq("id", id);
    if (error) {
      handleSupabaseError(error);
    }
  },

  async deleteFridgeItem(id: string, actionBy?: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: any = {
      status: FridgeItemStatus.DISCARDED,
      photo_url: null,
      check_out_date: new Date().toISOString()
    };
    if (actionBy) {
      payload.action_by = actionBy;
    }
    const { error } = await supabase.from("fridge_items").update(payload).eq("id", id);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
