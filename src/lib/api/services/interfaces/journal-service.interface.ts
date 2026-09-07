import type { JournalRecord, PaginatedResponse, PaginationOptions } from "$lib/types";

export interface JournalFilters {
  term?: string;
  type?: string;
  mop?: string;
  accountId?: string;
}

export interface JournalServiceInterface {
  fetchJournalEntries(
    filters?: JournalFilters,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>>;

  addJournalEntry(data: Partial<JournalRecord>): Promise<void>;

  updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void>;

  deleteJournalEntry(id: string): Promise<void>;

  batchAuditEntries(ids: string[]): Promise<void>;
}
