import { isSupabase } from "./common";
import { sheetsConstantsService } from "./sheets/constants-service";
import { supabaseConstantsService } from "./supabase/constants-service";

export const constantsService = isSupabase ? supabaseConstantsService : sheetsConstantsService;
