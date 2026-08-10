import type { JournalServiceInterface } from "./interfaces/journal-service.interface";
import { isSupabase } from "./common";
import { sheetsJournalService } from "./sheets/journal-service";
import { supabaseJournalService } from "./supabase/journal-service";

export const journalService: JournalServiceInterface = isSupabase
  ? supabaseJournalService
  : sheetsJournalService;

export * from "./interfaces/journal-service.interface";
