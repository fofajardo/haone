import { isSupabase } from "./common";
import { sheetsOfficerService } from "./sheets/officer-service";
import { supabaseOfficerService } from "./supabase/officer-service";
import type { OfficerServiceInterface } from "./interfaces/officer-service.interface";

export const officerService: OfficerServiceInterface = isSupabase
  ? supabaseOfficerService
  : sheetsOfficerService;

export * from "./interfaces/officer-service.interface";
