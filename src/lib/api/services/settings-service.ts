import { isSupabase } from "./common";
import type { SettingsServiceInterface } from "./interfaces/settings-service.interface";
import { sheetsSettingsService } from "./sheets/settings-service";
import { supabaseSettingsService } from "./supabase/settings-service";

export const settingsService: SettingsServiceInterface = isSupabase
  ? supabaseSettingsService
  : sheetsSettingsService;

export * from "./interfaces/settings-service.interface";
