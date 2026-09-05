import type {
  RoomsServiceInterface,
  CurrRecord,
  AccountRow,
  AccountUpdate
} from "../interfaces/rooms-service.interface";
import { CURR_COL, ACCOUNT_COL } from "$lib/types";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  batchUpdateValues,
  appendSheetRow,
  deleteSheetRow
} from "../common";

import { auth } from "$state/auth.svelte";

function mapAccountRow(r: string[]): AccountRow {
  return {
    id: (r[ACCOUNT_COL.ID] || "").trim(),
    residentId: (r[ACCOUNT_COL.RESIDENT_ID] || "").trim(),
    period: (r[ACCOUNT_COL.PERIOD] || "").trim(),
    room: (r[ACCOUNT_COL.ROOM] || "").trim(),
    bed: (r[ACCOUNT_COL.BED] || "").trim(),
    ceRefNo: (r[ACCOUNT_COL.CE_REFNO] || "").trim(),
    ceIssued: (r[ACCOUNT_COL.CE_ISSUED] || "").trim(),
    ceLink: (r[ACCOUNT_COL.CE_LINK] || "").trim(),
    accountNotes: (r[ACCOUNT_COL.NOTES] || "").trim(),
    issuerId: (r[ACCOUNT_COL.ISSUER_ID] || "").trim(),
    checkInDate: (r[ACCOUNT_COL.CHECK_IN_DATE] || "").trim(),
    type: (r[ACCOUNT_COL.TYPE] || "").trim()
  };
}

function accountToRowArray(a: AccountRow): string[] {
  const row = new Array(12).fill("");
  row[ACCOUNT_COL.ID] = a.id;
  row[ACCOUNT_COL.RESIDENT_ID] = a.residentId;
  row[ACCOUNT_COL.PERIOD] = a.period;
  row[ACCOUNT_COL.ROOM] = a.room;
  row[ACCOUNT_COL.BED] = a.bed;
  row[ACCOUNT_COL.CE_REFNO] = a.ceRefNo;
  row[ACCOUNT_COL.CE_ISSUED] = a.ceIssued;
  row[ACCOUNT_COL.CE_LINK] = a.ceLink;
  row[ACCOUNT_COL.NOTES] = a.accountNotes;
  row[ACCOUNT_COL.ISSUER_ID] = a.issuerId;
  row[ACCOUNT_COL.CHECK_IN_DATE] = a.checkInDate;
  row[ACCOUNT_COL.TYPE] = a.type;
  return row;
}

async function fetchAccountRows(spreadsheetId: string, bypassCache = false) {
  return fetchSheetRowsRaw(spreadsheetId, "accounts!A:L", bypassCache);
}

async function findAccountRowIndex(
  spreadsheetId: string,
  residentId: string,
  period: string
): Promise<{ rows: string[][]; rowIndex: number }> {
  const rows = await fetchAccountRows(spreadsheetId);
  const rowIndex = rows.findIndex(
    (r) =>
      (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId &&
      (r[ACCOUNT_COL.PERIOD] || "").trim() === period
  );
  return { rows, rowIndex };
}

export const sheetsRoomsService: RoomsServiceInterface = {
  async fetchCurrRecords(bypassCache = false): Promise<CurrRecord[]> {
    if (auth.isResident) {
      return [];
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      return [];
    }

    const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "CURR!A:P", bypassCache);
    return rows.slice(1).map((r, idx) => ({
      timestamp: (r[CURR_COL.TIMESTAMP] || "").trim(),
      email: (r[CURR_COL.EMAIL] || "").trim().toLowerCase(),
      room: (r[CURR_COL.ROOM] || "").trim(),
      bed: (r[CURR_COL.BED] || "").trim(),
      lastName: (r[CURR_COL.LAST_NAME] || "").trim().toUpperCase(),
      firstName: (r[CURR_COL.FIRST_NAME] || "").trim().toUpperCase(),
      college: (r[CURR_COL.COLLEGE] || "").trim(),
      program: (r[CURR_COL.PROGRAM] || "").trim(),
      studentNo: (r[CURR_COL.STUDENT_NO] || "").trim(),
      checkInDate: (r[CURR_COL.CHECK_IN_DATE] || "").trim(),
      isEvaluated: (r[CURR_COL.EVALUATED] || "").trim().toUpperCase() === "TRUE",
      term: (r[CURR_COL.TERM] || "").trim(),
      accountType: (r[CURR_COL.ACCOUNT_TYPE] || "").trim().toUpperCase(),
      suffix: (r[CURR_COL.SUFFIX] || "").trim().toUpperCase(),
      overrideName: (r[CURR_COL.OVERRIDE_NAME] || "").trim(),
      declineReason: (r[CURR_COL.DECLINE_REASON] || "").trim(),
      rowIndex: idx + 2,
      raw: r
    }));
  },

  async fetchAccounts(bypassCache = false): Promise<AccountRow[]> {
    if (auth.isResident) {
      return [];
    }
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      return [];
    }
    const rows = await fetchAccountRows(uiSettings.accountingWorkbookId, bypassCache);
    return rows.slice(1).map(mapAccountRow);
  },

  async updateAccounts(updates: AccountUpdate[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const rows = await fetchAccountRows(uiSettings.accountingWorkbookId);
    const batch: { range: string; values: any[][] }[] = [];

    for (const update of updates) {
      const rowIndex = rows.findIndex((r) => (r[ACCOUNT_COL.ID] || "").trim() === update.id);
      if (rowIndex === -1) {
        throw new Error("Account record not found.");
      }
      const actualRow = rowIndex + 1;
      const current = rows[rowIndex];

      if (update.room !== undefined || update.bed !== undefined) {
        const room = update.room !== undefined ? update.room : current[ACCOUNT_COL.ROOM] || "";
        const bed = update.bed !== undefined ? update.bed : current[ACCOUNT_COL.BED] || "";
        batch.push({ range: `accounts!D${actualRow}:E${actualRow}`, values: [[room, bed]] });
      }
      if (update.checkInDate !== undefined) {
        batch.push({
          range: `accounts!K${actualRow}`,
          values: [[update.checkInDate]]
        });
      }
    }

    if (batch.length > 0) {
      await batchUpdateValues(uiSettings.accountingWorkbookId, batch);
    }
  },

  async appendAccounts(accounts: AccountRow[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await appendSheetRow(
      uiSettings.accountingWorkbookId,
      "accounts!A:L",
      accounts.map(accountToRowArray)
    );
  },

  async markCurrEvaluated(
    entries: { email: string; term: string; rowId?: string | number }[]
  ): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }

    const batch: { range: string; values: any[][] }[] = [];

    for (const entry of entries) {
      if (entry.rowId !== undefined && typeof entry.rowId === "number") {
        batch.push({ range: `CURR!K${entry.rowId}`, values: [["TRUE"]] });
      } else {
        const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "CURR!A:P");
        const targetEmail = entry.email.trim().toLowerCase();
        rows.forEach((r, idx) => {
          const email = (r[CURR_COL.EMAIL] || "").trim().toLowerCase();
          const term = (r[CURR_COL.TERM] || "").trim();
          const isEvaluated = (r[CURR_COL.EVALUATED] || "").trim().toUpperCase() === "TRUE";
          if (!isEvaluated && email === targetEmail && term === entry.term) {
            batch.push({ range: `CURR!K${idx + 1}`, values: [["TRUE"]] });
          }
        });
      }
    }

    if (batch.length > 0) {
      await batchUpdateValues(uiSettings.residentRecordsId, batch);
    }
  },

  async declineCurrRecord(
    email: string,
    term: string,
    reason: string,
    rowId?: string | number
  ): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }

    const batch: { range: string; values: any[][] }[] = [];

    if (rowId !== undefined && typeof rowId === "number") {
      batch.push({
        range: `CURR!K${rowId}`,
        values: [["TRUE"]]
      });
      batch.push({
        range: `CURR!P${rowId}`,
        values: [[reason]]
      });
    } else {
      const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "CURR!A:P");
      const targetEmail = email.trim().toLowerCase();
      rows.forEach((r, idx) => {
        const rowEmail = (r[CURR_COL.EMAIL] || "").trim().toLowerCase();
        const rowTerm = (r[CURR_COL.TERM] || "").trim();
        const isEvaluated = (r[CURR_COL.EVALUATED] || "").trim().toUpperCase() === "TRUE";
        if (!isEvaluated && rowEmail === targetEmail && rowTerm === term) {
          batch.push({
            range: `CURR!K${idx + 1}`,
            values: [["TRUE"]]
          });
          batch.push({
            range: `CURR!P${idx + 1}`,
            values: [[reason]]
          });
        }
      });
    }

    if (batch.length > 0) {
      await batchUpdateValues(uiSettings.residentRecordsId, batch);
    }
  },

  async updateAccountRoomBed(
    residentId: string,
    period: string,
    room: string,
    bed: string
  ): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const { rowIndex } = await findAccountRowIndex(
      uiSettings.accountingWorkbookId,
      residentId,
      period
    );
    if (rowIndex === -1) {
      throw new Error("Account record not found.");
    }
    const actualRow = rowIndex + 1;
    await updateSheetValue(
      uiSettings.accountingWorkbookId,
      `accounts!D${actualRow}:E${actualRow}`,
      [[room, bed]]
    );
  },

  async addAccount(account: AccountRow): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:L", [
      accountToRowArray(account)
    ]);
  },

  async deleteAccountRow(residentId: string, period: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const { rowIndex } = await findAccountRowIndex(
      uiSettings.accountingWorkbookId,
      residentId,
      period
    );
    if (rowIndex === -1) {
      throw new Error("Account record not found.");
    }
    await deleteSheetRow(uiSettings.accountingWorkbookId, "accounts", rowIndex);
  },

  async updateAccountBed(residentId: string, period: string, bed: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const { rowIndex } = await findAccountRowIndex(
      uiSettings.accountingWorkbookId,
      residentId,
      period
    );
    if (rowIndex === -1) {
      throw new Error("Account record not found.");
    }
    const actualRow = rowIndex + 1;
    await updateSheetValue(uiSettings.accountingWorkbookId, `accounts!E${actualRow}`, [[bed]]);
  }
};
