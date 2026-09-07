import { isSupabase } from "./common";
import type { OfficerServiceInterface } from "./interfaces/officer-service.interface";
import { sheetsOfficerService } from "./sheets/officer-service";
import { supabaseOfficerService } from "./supabase/officer-service";

export const officerService: OfficerServiceInterface = isSupabase
  ? supabaseOfficerService
  : sheetsOfficerService;

export * from "./interfaces/officer-service.interface";
