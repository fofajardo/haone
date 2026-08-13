import type { AchievementServiceInterface } from "../interfaces/achievement-service.interface";
import type {
  AchievementRecord,
  AchievementLogRecord,
  PaginationOptions,
  PaginatedResponse
} from "$lib/types";
import {
  supabase,
  handleSupabaseError,
  assertSupabaseFound,
  fetchAllSupabaseRows
} from "../common";

import { isUuid } from "$utils/parsers";

function emptyLogs(
  options?: PaginationOptions
): AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord> {
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

export const supabaseAchievementService: AchievementServiceInterface = {
  async fetchAchievements(
    options?: PaginationOptions,
    _forceRefresh?: boolean
  ): Promise<AchievementRecord[] | PaginatedResponse<AchievementRecord>> {
    if (!supabase) {
      return [];
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize! - 1;
      const { data: d, error, count: c } = await supabase
        .from("achievements")
        .select("*", { count: "exact" })
        .range(start, end);
      if (error) {
        handleSupabaseError(error);
      }
      data = d || [];
      count = c || 0;
    } else {
      const { data: d, error } = await supabase.from("achievements").select("*");
      if (error) {
        handleSupabaseError(error);
      }
      data = d || [];
    }

    const items = data.map((row: any) => ({
      id: row.id,
      creatorId: row.creator_id || "",
      name: row.name || "",
      description: row.description || "",
      icon: row.icon || "",
      extraUrl: row.extra_url || "",
      term: row.term || "",
      points: row.points || 0,
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

  async fetchAchievementLogs(
    residentId?: string,
    options?: PaginationOptions,
    _forceRefresh?: boolean
  ): Promise<AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord>> {
    if (!supabase) {
      return [];
    }

    if (residentId && !isUuid(residentId)) {
      // A non-UUID id can never match; Sheets' equality filter yields nothing.
      return emptyLogs(options);
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      let query = supabase.from("achievement_records").select("*", { count: "exact" });
      if (residentId) {
        query = query.eq("account_id", residentId);
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
        let query = sb.from("achievement_records").select("*");
        if (residentId) {
          query = query.eq("account_id", residentId);
        }
        return query.order("date", { ascending: true }).order("id", { ascending: true });
      });
    }

    const items: AchievementLogRecord[] = data.map((row: any) => ({
      id: row.id,
      recorderId: row.recorder_id,
      accountId: row.account_id,
      date: row.date,
      achievementId: row.achievement_id,
      term: row.term,
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

  async addAchievement(data: Partial<AchievementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievements").insert({
      id: data.id || crypto.randomUUID(),
      creator_id: data.creatorId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      extra_url: data.extraUrl,
      term: data.term,
      points: data.points ?? 0
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateAchievement(id: string, data: Partial<AchievementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.creatorId !== undefined) {
      payload.creator_id = data.creatorId;
    }
    if (data.name !== undefined) {
      payload.name = data.name;
    }
    if (data.description !== undefined) {
      payload.description = data.description;
    }
    if (data.icon !== undefined) {
      payload.icon = data.icon;
    }
    if (data.extraUrl !== undefined) {
      payload.extra_url = data.extraUrl;
    }
    if (data.term !== undefined) {
      payload.term = data.term;
    }
    if (data.points !== undefined) {
      payload.points = data.points;
    }

    const { data: updated, error } = await supabase
      .from("achievements")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Achievement not found");
  },

  async deleteAchievement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("achievements").delete().eq("id", id).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Achievement not found");
  },

  async awardAchievement(data: Partial<AchievementLogRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievement_records").insert({
      id: data.id || crypto.randomUUID(),
      recorder_id: data.recorderId,
      account_id: data.accountId,
      date: data.date,
      achievement_id: data.achievementId,
      term: data.term
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async revokeAchievement(logId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("achievement_records")
      .delete()
      .eq("id", logId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Achievement log not found");
  },

  async awardAchievementBatch(records: Partial<AchievementLogRecord>[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const toInsert = records.map((r) => ({
      id: r.id || crypto.randomUUID(),
      recorder_id: r.recorderId,
      account_id: r.accountId,
      date: r.date,
      achievement_id: r.achievementId,
      term: r.term
    }));

    const { error } = await supabase.from("achievement_records").insert(toInsert);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
