import { isSupabase } from "./common";
import { sheetsJournalService } from "./sheets/journal-service";
import { supabaseJournalService } from "./supabase/journal-service";

export const journalService = isSupabase ? supabaseJournalService : sheetsJournalService;
export type { JournalFilters } from "./interfaces/journal-service.interface";
