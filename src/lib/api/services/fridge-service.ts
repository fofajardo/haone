import { isSupabase } from "./common";
import type { FridgeServiceInterface } from "./interfaces/fridge-service.interface";
import { sheetsFridgeService } from "./sheets/fridge-service";
import { supabaseFridgeService } from "./supabase/fridge-service";

export const fridgeService: FridgeServiceInterface = isSupabase
  ? supabaseFridgeService
  : sheetsFridgeService;

export * from "./interfaces/fridge-service.interface";
