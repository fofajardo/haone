import type { AchievementServiceInterface } from "../interfaces/achievement-service.interface";
import type {
  AchievementRecord,
  AchievementLogRecord,
  PaginationOptions,
  PaginatedResponse
} from "$lib/types";
import { supabase } from "../common";

import { isUuid } from "$utils/parsers";

export const supabaseAchievementService: AchievementServiceInterface = {
  async fetchAchievements(
    options?: PaginationOptions
  ): Promise<AchievementRecord[] | PaginatedResponse<AchievementRecord>> {
    if (!supabase) {
      return [];
    }

    let query = supabase.from("achievements").select("*", { count: "exact" });

    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize - 1;
      query = query.range(start, end);
    }

    const { data, count, error } = await query;
    if (error) {
      throw error;
    }

    const items: AchievementRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      creatorId: row.creator_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      extraUrl: row.extra_url,
      term: row.term,
      points: row.points,
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

  async fetchAchievementLogs(
    residentId?: string,
    options?: PaginationOptions
  ): Promise<AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord>> {
    if (!supabase) {
      return [];
    }

    let query = supabase.from("achievement_records").select("*", { count: "exact" });

    if (residentId && isUuid(residentId)) {
      query = query.eq("account_id", residentId);
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

    const items: AchievementLogRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      recorderId: row.recorder_id,
      accountId: row.account_id,
      date: row.date,
      achievementId: row.achievement_id,
      term: row.term,
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

  async addAchievement(data: Partial<AchievementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievements").insert({
      creator_id: data.creatorId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      extra_url: data.extraUrl,
      term: data.term,
      points: data.points
    });
    if (error) {
      throw error;
    }
  },

  async updateAchievement(id: string, data: Partial<AchievementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
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

    const { error } = await supabase.from("achievements").update(payload).eq("id", id);
    if (error) {
      throw error;
    }
  },

  async deleteAchievement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievements").delete().eq("id", id);
    if (error) {
      throw error;
    }
  },

  async awardAchievement(data: Partial<AchievementLogRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievement_records").insert({
      recorder_id: data.recorderId,
      account_id: data.accountId,
      date: data.date,
      achievement_id: data.achievementId,
      term: data.term
    });
    if (error) {
      throw error;
    }
  },

  async revokeAchievement(logId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievement_records").delete().eq("id", logId);
    if (error) {
      throw error;
    }
  },

  async awardAchievementBatch(records: Partial<AchievementLogRecord>[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const toInsert = records.map((r) => ({
      recorder_id: r.recorderId,
      account_id: r.accountId,
      date: r.date,
      achievement_id: r.achievementId,
      term: r.term
    }));

    const { error } = await supabase.from("achievement_records").insert(toInsert);
    if (error) {
      throw error;
    }
  }
};
