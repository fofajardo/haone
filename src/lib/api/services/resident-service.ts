import type { ResidentServiceInterface } from "./interfaces/resident-service.interface";
import { sheetsResidentService } from "./sheets/resident-service";
import { supabaseResidentService } from "./supabase/resident-service";
import { isSupabase } from "./common";

export const residentService: ResidentServiceInterface = isSupabase
  ? supabaseResidentService
  : sheetsResidentService;
