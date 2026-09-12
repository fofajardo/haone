import { isSupabase } from "./common";
import type { AchievementServiceInterface } from "./interfaces/achievement-service.interface";
import { sheetsAchievementService } from "./sheets/achievement-service";
import { supabaseAchievementService } from "./supabase/achievement-service";

export const achievementService: AchievementServiceInterface = isSupabase
  ? supabaseAchievementService
  : sheetsAchievementService;

export * from "./interfaces/achievement-service.interface";
