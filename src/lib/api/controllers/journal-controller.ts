import { journalService, type JournalFilters } from "$api/services/journal-service";
import type { JournalRecord, PaginationOptions, PaginatedResponse } from "$lib/types";

export { mapRowToJournal } from "./resident-controller";

export async function fetchJournalEntries(
  filters?: JournalFilters,
  options?: PaginationOptions
): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>> {
  return journalService.fetchJournalEntries(filters, options);
}

export async function addJournalEntry(data: Partial<JournalRecord>): Promise<void> {
  return journalService.addJournalEntry(data);
}

export async function addJournalEntries(entries: Partial<JournalRecord>[]): Promise<void> {
  for (const entry of entries) {
    await journalService.addJournalEntry(entry);
  }
}

export async function updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void> {
  return journalService.updateJournalEntry(id, data);
}

export async function deleteJournalEntry(id: string): Promise<void> {
  return journalService.deleteJournalEntry(id);
}

export async function batchAuditEntries(ids: string[]): Promise<void> {
  return journalService.batchAuditEntries(ids);
}

export async function updateJournalReceiptInfo(
  recordId: string,
  prDateIssued: string,
  prRefNo: string,
  receiptUrl: string
): Promise<void> {
  return journalService.updateJournalEntry(recordId, {
    prDateIssued,
    prRefNo,
    receiptUrl
  });
}
