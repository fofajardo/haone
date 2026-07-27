import { isSupabase } from "./common";
import { sheetsAchievementService } from "./sheets/achievement-service";
import { supabaseAchievementService } from "./supabase/achievement-service";
import type { AchievementServiceInterface } from "./interfaces/achievement-service.interface";

export const achievementService: AchievementServiceInterface = isSupabase
  ? supabaseAchievementService
  : sheetsAchievementService;

export * from "./interfaces/achievement-service.interface";
