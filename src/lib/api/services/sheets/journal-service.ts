import type {
  JournalServiceInterface,
  JournalFilters
} from "../interfaces/journal-service.interface";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow,
  deleteSheetRow,
  batchUpdateValues
} from "../common";
import {
  JOURNAL_COL,
  type JournalRecord,
  type PaginationOptions,
  type PaginatedResponse
} from "$lib/types";

import { parseCSVAmount } from "$utils/math";
import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

function mapRow(row: string[], idx: number): JournalRecord {
  const water = parseCSVAmount(row[JOURNAL_COL.WATER]);
  const assoc = parseCSVAmount(row[JOURNAL_COL.ASSOC]);
  const misc = parseCSVAmount(row[JOURNAL_COL.MISC]);
  return {
    date: (row[JOURNAL_COL.DATE] || "").trim(),
    creator: (row[JOURNAL_COL.CREATOR] || "").trim(),
    account: (row[JOURNAL_COL.ACCOUNT] || "").trim(),
    water,
    assoc,
    misc,
    amount: water + assoc + misc,
    mop: (row[JOURNAL_COL.MOP] || "").trim(),
    period: (row[JOURNAL_COL.PERIOD] || "").trim(),
    type: (row[JOURNAL_COL.TYPE] || "").trim(),
    notes: (row[JOURNAL_COL.NOTES] || "").trim(),
    notesPrivate: (row[JOURNAL_COL.NOTES_PRIVATE] || "").trim(),
    mopRefNo: (row[JOURNAL_COL.MOP_REFNO] || "").trim(),
    prDateIssued: (row[JOURNAL_COL.PR_DATE_ISSUED] || "").trim(),
    prRefNo: (row[JOURNAL_COL.PR_REFNO] || "").trim(),
    creatorName: (row[JOURNAL_COL.CREATOR_NAME] || "").trim(),
    name: (row[JOURNAL_COL.NAME] || "").trim(),
    stno: (row[JOURNAL_COL.STNO] || "").trim(),
    wasAudited: (row[JOURNAL_COL.WAS_AUDITED] || "").toUpperCase() === "TRUE",
    receiptUrl: (row[JOURNAL_COL.RECEIPT_URL] || "").trim(),
    id: (row[JOURNAL_COL.ID] || "").trim(),
    ledgerIndex: idx,
    raw: row
  };
}

export const sheetsJournalService: JournalServiceInterface = {
  async fetchJournalEntries(
    filters?: JournalFilters,
    options?: PaginationOptions,
    bypassCache = false
  ): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>> {
    const shouldRefresh = bypassCache || options?.bypassCache || false;
    if (auth.isResident) {
      const query = filters?.term ? `?term=${encodeURIComponent(filters.term)}` : "";
      const status = await fetchServer(`/api/resident/check-status${query}`, {}, shouldRefresh);
      let items: JournalRecord[] = status.transactions || [];
      if (filters?.type) {
        items = items.filter((r) => r.type === filters.type);
      }
      if (filters?.mop) {
        items = items.filter((r) => r.mop === filters.mop);
      }
      return items;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    const spreadsheetId = uiSettings.accountingWorkbookId;
    if (!spreadsheetId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(spreadsheetId, "journal_general!A:T", shouldRefresh);
    let items = rows.slice(1).map((row, idx) => mapRow(row, idx + 2));

    if (filters?.term) {
      items = items.filter((r) => r.period === filters.term);
    }
    if (filters?.type) {
      items = items.filter((r) => r.type === filters.type);
    }
    if (filters?.mop) {
      items = items.filter((r) => r.mop === filters.mop);
    }
    if (filters?.accountId) {
      items = items.filter((r) => r.account === filters.accountId);
    }

    return items;
  },

  async addJournalEntry(data: Partial<JournalRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    const spreadsheetId = uiSettings.accountingWorkbookId;
    if (!spreadsheetId) {
      throw new Error("Accounting workbook ID not configured");
    }
    const row = new Array(20).fill("");
    row[JOURNAL_COL.DATE] = data.date || "";
    row[JOURNAL_COL.CREATOR] = data.creator || "";
    row[JOURNAL_COL.ACCOUNT] = data.account || "";
    row[JOURNAL_COL.WATER] = data.water ?? 0;
    row[JOURNAL_COL.ASSOC] = data.assoc ?? 0;
    row[JOURNAL_COL.MISC] = data.misc ?? 0;
    row[JOURNAL_COL.MOP] = data.mop || "";
    row[JOURNAL_COL.PERIOD] = data.period || "";
    row[JOURNAL_COL.TYPE] = data.type || "";
    row[JOURNAL_COL.NOTES] = data.notes || "";
    row[JOURNAL_COL.NOTES_PRIVATE] = data.notesPrivate || "";
    row[JOURNAL_COL.MOP_REFNO] = data.mopRefNo || "";
    row[JOURNAL_COL.PR_DATE_ISSUED] = data.prDateIssued || "";
    row[JOURNAL_COL.PR_REFNO] = data.prRefNo || "";
    row[JOURNAL_COL.CREATOR_NAME] = data.creatorName || "";
    row[JOURNAL_COL.NAME] = data.name || "";
    row[JOURNAL_COL.STNO] = data.stno || "";
    row[JOURNAL_COL.WAS_AUDITED] = "FALSE";
    row[JOURNAL_COL.RECEIPT_URL] = data.receiptUrl || "";
    row[JOURNAL_COL.ID] = data.id || crypto.randomUUID();
    await appendSheetRow(spreadsheetId, "journal_general!A:T", [row]);
  },

  async updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    const spreadsheetId = uiSettings.accountingWorkbookId;
    if (!spreadsheetId) {
      throw new Error("Accounting workbook ID not configured");
    }
    const rows = await fetchSheetRowsRaw(spreadsheetId, "journal_general!A:T");
    const rowIndex = rows.findIndex((r) => (r[JOURNAL_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Journal entry not found");
    }
    const actualRow = rowIndex + 1;
    const newRow = [...rows[rowIndex]];
    if (data.date !== undefined) {
      newRow[JOURNAL_COL.DATE] = data.date;
    }
    if (data.creator !== undefined) {
      newRow[JOURNAL_COL.CREATOR] = data.creator;
    }
    if (data.account !== undefined) {
      newRow[JOURNAL_COL.ACCOUNT] = data.account;
    }
    if (data.water !== undefined) {
      newRow[JOURNAL_COL.WATER] = String(data.water);
    }
    if (data.assoc !== undefined) {
      newRow[JOURNAL_COL.ASSOC] = String(data.assoc);
    }
    if (data.misc !== undefined) {
      newRow[JOURNAL_COL.MISC] = String(data.misc);
    }
    if (data.mop !== undefined) {
      newRow[JOURNAL_COL.MOP] = data.mop;
    }
    if (data.period !== undefined) {
      newRow[JOURNAL_COL.PERIOD] = data.period;
    }
    if (data.type !== undefined) {
      newRow[JOURNAL_COL.TYPE] = data.type;
    }
    if (data.notes !== undefined) {
      newRow[JOURNAL_COL.NOTES] = data.notes;
    }
    if (data.notesPrivate !== undefined) {
      newRow[JOURNAL_COL.NOTES_PRIVATE] = data.notesPrivate;
    }
    if (data.mopRefNo !== undefined) {
      newRow[JOURNAL_COL.MOP_REFNO] = data.mopRefNo;
    }
    if (data.prDateIssued !== undefined) {
      newRow[JOURNAL_COL.PR_DATE_ISSUED] = data.prDateIssued;
    }
    if (data.prRefNo !== undefined) {
      newRow[JOURNAL_COL.PR_REFNO] = data.prRefNo;
    }
    if (data.creatorName !== undefined) {
      newRow[JOURNAL_COL.CREATOR_NAME] = data.creatorName;
    }
    if (data.name !== undefined) {
      newRow[JOURNAL_COL.NAME] = data.name;
    }
    if (data.stno !== undefined) {
      newRow[JOURNAL_COL.STNO] = data.stno;
    }
    if (data.wasAudited !== undefined) {
      newRow[JOURNAL_COL.WAS_AUDITED] = data.wasAudited ? "TRUE" : "FALSE";
    }
    if (data.receiptUrl !== undefined) {
      newRow[JOURNAL_COL.RECEIPT_URL] = data.receiptUrl;
    }
    await updateSheetValue(spreadsheetId, `journal_general!A${actualRow}:T${actualRow}`, [newRow]);
  },

  async deleteJournalEntry(id: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    const spreadsheetId = uiSettings.accountingWorkbookId;
    if (!spreadsheetId) {
      throw new Error("Accounting workbook ID not configured");
    }
    const rows = await fetchSheetRowsRaw(spreadsheetId, "journal_general!A:T");
    const rowIndex = rows.findIndex((r) => (r[JOURNAL_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Journal entry not found");
    }
    await deleteSheetRow(spreadsheetId, "journal_general", rowIndex);
  },

  async batchAuditEntries(ids: string[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    const spreadsheetId = uiSettings.accountingWorkbookId;
    if (!spreadsheetId) {
      throw new Error("Accounting workbook ID not configured");
    }
    const rows = await fetchSheetRowsRaw(spreadsheetId, "journal_general!A:T", true);
    const updates: { range: string; values: any[][] }[] = [];
    for (const id of ids) {
      const rowIndex = rows.findIndex((r) => (r[JOURNAL_COL.ID] || "").trim() === id);
      if (rowIndex !== -1) {
        updates.push({
          range: `journal_general!R${rowIndex + 1}`,
          values: [["TRUE"]]
        });
      }
    }
    if (updates.length > 0) {
      await batchUpdateValues(spreadsheetId, updates);
    }
  }
};
