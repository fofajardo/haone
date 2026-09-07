import { isSupabase } from "./common";
import type { ResidentServiceInterface } from "./interfaces/resident-service.interface";
import { sheetsResidentService } from "./sheets/resident-service";
import { supabaseResidentService } from "./supabase/resident-service";

export const residentService: ResidentServiceInterface = isSupabase
  ? supabaseResidentService
  : sheetsResidentService;

export * from "./interfaces/resident-service.interface";
