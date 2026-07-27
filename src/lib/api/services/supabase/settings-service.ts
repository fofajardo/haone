import type { SettingsServiceInterface } from "../interfaces/settings-service.interface";
import type { UserSettingsRecord } from "$lib/types";
import { supabase } from "../common";
import { isUuid } from "$utils/parsers";

export const supabaseSettingsService: SettingsServiceInterface = {
  async fetchUserSettings(residentId: string): Promise<UserSettingsRecord | null> {
    if (!supabase) {
      return null;
    }
    if (!residentId || !isUuid(residentId)) {
      return null;
    }
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("resident_id", residentId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      residentId: data.resident_id,
      isPublicAchievementList: data.is_public_achievement_list,
      residentNav: data.resident_nav,
      adminNav: data.admin_nav,
      density: data.density,
      typography: data.typography,
      theme: data.theme,
      isReducedMotion: data.is_reduced_motion,
      clockFormat: data.clock_format,
      raw: data
    };
  },

  async updateUserSettings(residentId: string, data: Partial<UserSettingsRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = { resident_id: residentId };
    if (data.isPublicAchievementList !== undefined) {
      payload.is_public_achievement_list = data.isPublicAchievementList;
    }
    if (data.residentNav !== undefined) {
      payload.resident_nav = data.residentNav;
    }
    if (data.adminNav !== undefined) {
      payload.admin_nav = data.adminNav;
    }
    if (data.density !== undefined) {
      payload.density = data.density;
    }
    if (data.typography !== undefined) {
      payload.typography = data.typography;
    }
    if (data.theme !== undefined) {
      payload.theme = data.theme;
    }
    if (data.isReducedMotion !== undefined) {
      payload.is_reduced_motion = data.isReducedMotion;
    }
    if (data.clockFormat !== undefined) {
      payload.clock_format = data.clockFormat;
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "resident_id" });

    if (error) {
      throw error;
    }
  }
};
