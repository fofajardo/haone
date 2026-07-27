import { isSupabase } from "./common";
import { sheetsLaundryService } from "./sheets/laundry-service";
import { supabaseLaundryService } from "./supabase/laundry-service";
import type { LaundryServiceInterface } from "./interfaces/laundry-service.interface";

export const laundryService: LaundryServiceInterface = isSupabase
  ? supabaseLaundryService
  : sheetsLaundryService;

export * from "./interfaces/laundry-service.interface";
