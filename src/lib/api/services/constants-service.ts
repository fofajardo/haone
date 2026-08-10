import type { ConstantsServiceInterface } from "./interfaces/constants-service.interface";
import { isSupabase } from "./common";
import { sheetsConstantsService } from "./sheets/constants-service";
import { supabaseConstantsService } from "./supabase/constants-service";

export const constantsService: ConstantsServiceInterface = isSupabase
  ? supabaseConstantsService
  : sheetsConstantsService;

export * from "./interfaces/constants-service.interface";
