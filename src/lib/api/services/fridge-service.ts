import { isSupabase } from "./common";
import { sheetsFridgeService } from "./sheets/fridge-service";
import { supabaseFridgeService } from "./supabase/fridge-service";
import type { FridgeServiceInterface } from "./interfaces/fridge-service.interface";

export const fridgeService: FridgeServiceInterface = isSupabase
  ? supabaseFridgeService
  : sheetsFridgeService;

export * from "./interfaces/fridge-service.interface";
