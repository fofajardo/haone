import type { RoomsServiceInterface, CurrRecord } from "../interfaces/rooms-service.interface";
import { CURR_COL, ACCOUNT_COL } from "$lib/types";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  batchUpdateValues,
  appendSheetRow,
  deleteSheetRow
} from "../common";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

export const sheetsRoomsService: RoomsServiceInterface = {
  async fetchCurrRecords(forceRefresh = false): Promise<CurrRecord[]> {
    if (auth.isResident) {
      return [];
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      return [];
    }

    const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "CURR!A:O", forceRefresh);
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
      accountType: (r[CURR_COL.ACCOUNT_TYPE] || "STUDENT").trim().toUpperCase(),
      suffix: (r[CURR_COL.SUFFIX] || "").trim().toUpperCase(),
      overrideName: (r[CURR_COL.OVERRIDE_NAME] || "").trim(),
      rowIndex: idx + 2,
      raw: r
    }));
  },

  async fetchAccountsRaw(forceRefresh = false): Promise<any[]> {
    if (auth.isResident) {
      return [];
    }
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      return [];
    }
    return fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L", forceRefresh);
  },

  async batchUpdateAccounts(updates: { range: string; values: any[][] }[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await batchUpdateValues(uiSettings.accountingWorkbookId, updates);
  },

  async appendAccounts(rows: any[][]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:L", rows);
  },

  async batchUpdateCurr(updates: { range: string; values: any[][] }[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    await batchUpdateValues(uiSettings.residentRecordsId, updates);
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

    const accRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L");
    const rowIndex = accRows.findIndex(
      (r) =>
        (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId &&
        (r[ACCOUNT_COL.PERIOD] || "").trim() === period
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

  async addAccountRow(row: any[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:L", [row]);
  },

  async deleteAccountRow(residentId: string, period: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const accRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L");
    const rowIndex = accRows.findIndex(
      (r) =>
        (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId &&
        (r[ACCOUNT_COL.PERIOD] || "").trim() === period
    );
    if (rowIndex === -1) {
      throw new Error("Account record not found.");
    }
    await deleteSheetRow(uiSettings.accountingWorkbookId, "accounts", rowIndex);
  },

  async updateAccountCheckInDate(residentId: string, period: string, date: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const accRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L");
    const rowIndex = accRows.findIndex(
      (r) =>
        (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId &&
        (r[ACCOUNT_COL.PERIOD] || "").trim() === period
    );
    if (rowIndex === -1) {
      throw new Error("Account record not found.");
    }
    const actualRow = rowIndex + 1;
    await updateSheetValue(uiSettings.accountingWorkbookId, `accounts!E${actualRow}`, [[date]]);
  },

  async fetchStaticIpRows(): Promise<any[]> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return [];
    }
    return fetchSheetRowsRaw(uiSettings.sharedRecordsId, "static_ip!A:G");
  },

  async appendStaticIpRows(rows: any[][]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return;
    }
    await appendSheetRow(uiSettings.sharedRecordsId, "static_ip!A:G", rows);
  }
};
