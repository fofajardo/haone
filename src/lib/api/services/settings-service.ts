import { isSupabase } from "./common";
import { sheetsSettingsService } from "./sheets/settings-service";
import { supabaseSettingsService } from "./supabase/settings-service";
import type { SettingsServiceInterface } from "./interfaces/settings-service.interface";

export const settingsService: SettingsServiceInterface = isSupabase
  ? supabaseSettingsService
  : sheetsSettingsService;

export * from "./interfaces/settings-service.interface";
