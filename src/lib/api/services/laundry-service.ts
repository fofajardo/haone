import { isSupabase } from "./common";
import type { LaundryServiceInterface } from "./interfaces/laundry-service.interface";
import { sheetsLaundryService } from "./sheets/laundry-service";
import { supabaseLaundryService } from "./supabase/laundry-service";

export const laundryService: LaundryServiceInterface = isSupabase
  ? supabaseLaundryService
  : sheetsLaundryService;

export * from "./interfaces/laundry-service.interface";
