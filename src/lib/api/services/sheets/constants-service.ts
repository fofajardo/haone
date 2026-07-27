import type { ConstantsServiceInterface } from "../interfaces/constants-service.interface";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow, batchUpdateValues } from "../common";
import { CONSTANT_COL, type ConstantRecord } from "$lib/types";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

export const sheetsConstantsService: ConstantsServiceInterface = {
  async fetchConstants(forceRefresh = false): Promise<ConstantRecord[]> {
    if (auth.isResident) {
      const data = await fetchServer("/api/resident/check-status", {}, forceRefresh);
      const consts: ConstantRecord[] = [
        { key: "TERM_CURR", value: data.activeTerm || "", description: "Current Term", raw: [] }
      ];
      if (Array.isArray(data.transactionTypes)) {
        for (const t of data.transactionTypes) {
          consts.push({ key: t.value, value: t.label, description: t.label, raw: [] });
        }
      }
      if (Array.isArray(data.mopTypes)) {
        for (const m of data.mopTypes) {
          consts.push({ key: m.value, value: m.label, description: m.label, raw: [] });
        }
      }
      return consts;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.accountingWorkbookId,
      "constants!A:C",
      forceRefresh
    );
    return rows.slice(1).map((row) => ({
      key: (row[CONSTANT_COL.KEY] || "").trim(),
      value: (row[CONSTANT_COL.VALUE] || "").trim(),
      description: (row[CONSTANT_COL.DESCRIPTION] || "").trim(),
      raw: row
    }));
  },

  async fetchConstantByKey(key: string): Promise<string | null> {
    const all = await this.fetchConstants();
    return all.find((c) => c.key === key)?.value ?? null;
  },

  async addConstant(key: string, value: string, description = ""): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await appendSheetRow(uiSettings.accountingWorkbookId, "constants!A:C", [
      [key, value, description]
    ]);
  },

  async updateConstant(key: string, value: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C");
    const rowIndex = rows.findIndex((r) => (r[CONSTANT_COL.KEY] || "").trim() === key);
    if (rowIndex === -1) {
      throw new Error(`Constant "${key}" not found`);
    }
    const actualRow = rowIndex + 1;
    await updateSheetValue(uiSettings.accountingWorkbookId, `constants!B${actualRow}`, [[value]]);
  },

  async batchUpdateConstants(updates: { range: string; values: any[][] }[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }
    await batchUpdateValues(uiSettings.accountingWorkbookId, updates);
  }
};
