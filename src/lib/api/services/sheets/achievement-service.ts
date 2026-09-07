import {
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  type AchievementLogRecord,
  type AchievementRecord,
  type PaginatedResponse,
  type PaginationOptions
} from "$lib/types";
import { appendSheetRow, deleteSheetRow, fetchSheetRowsRaw, updateSheetValue } from "../common";
import type { AchievementServiceInterface } from "../interfaces/achievement-service.interface";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";
import { parseCSVAmount } from "$utils/math";
import { getLocalDateString } from "$utils/parsers";

let _residentFetch: Promise<any> | null = null;

function fetchResidentAchievements(bypassCache = false) {
  if (!_residentFetch || bypassCache) {
    _residentFetch = fetchServer("/api/resident/achievements", {}, bypassCache).finally(() => {
      _residentFetch = null;
    });
  }
  return _residentFetch;
}

export const sheetsAchievementService: AchievementServiceInterface = {
  async fetchAchievements(
    options?: PaginationOptions,
    bypassCache = false
  ): Promise<AchievementRecord[] | PaginatedResponse<AchievementRecord>> {
    const shouldRefresh = bypassCache || options?.bypassCache || false;
    if (auth.isResident) {
      const data = await fetchResidentAchievements(shouldRefresh);
      return data.achievements || [];
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.sharedRecordsId,
      "achievements!A:H",
      shouldRefresh
    );
    return rows.slice(1).map((row) => ({
      id: (row[ACHIEVEMENT_COL.ID] || "").trim(),
      creatorId: (row[ACHIEVEMENT_COL.CREATOR_ID] || "").trim(),
      name: (row[ACHIEVEMENT_COL.NAME] || "").trim(),
      description: (row[ACHIEVEMENT_COL.DESCRIPTION] || "").trim(),
      icon: (row[ACHIEVEMENT_COL.ICON] || "").trim(),
      extraUrl: (row[ACHIEVEMENT_COL.EXTRA_URL] || "").trim(),
      term: (row[ACHIEVEMENT_COL.TERM] || "").trim(),
      points: parseCSVAmount(row[ACHIEVEMENT_COL.POINTS]),
      raw: row
    }));
  },

  async fetchAchievementLogs(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache = false
  ): Promise<AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord>> {
    const shouldRefresh = bypassCache || options?.bypassCache || false;
    if (auth.isResident) {
      const data = await fetchResidentAchievements(shouldRefresh);
      return data.logs || [];
    }
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.sharedRecordsId,
      "achievement_records!A:F",
      shouldRefresh
    );
    let items = rows.slice(1).map((row) => ({
      id: (row[ACHIEVEMENT_RECORD_COL.ID] || "").trim(),
      recorderId: (row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] || "").trim(),
      accountId: (row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] || "").trim(),
      date: (row[ACHIEVEMENT_RECORD_COL.DATE] || "").trim(),
      achievementId: (row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] || "").trim(),
      term: (row[ACHIEVEMENT_RECORD_COL.TERM] || "").trim(),
      raw: row
    }));
    if (residentId) {
      items = items.filter((l) => l.accountId === residentId);
    }
    return items;
  },

  async addAchievement(data: Partial<AchievementRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const row = new Array(8).fill("");
    row[ACHIEVEMENT_COL.ID] = data.id || crypto.randomUUID();
    row[ACHIEVEMENT_COL.CREATOR_ID] = data.creatorId || "";
    row[ACHIEVEMENT_COL.NAME] = data.name || "";
    row[ACHIEVEMENT_COL.DESCRIPTION] = data.description || "";
    row[ACHIEVEMENT_COL.ICON] = data.icon || "";
    row[ACHIEVEMENT_COL.EXTRA_URL] = data.extraUrl || "";
    row[ACHIEVEMENT_COL.TERM] = data.term || "";
    row[ACHIEVEMENT_COL.POINTS] = String(data.points || 0);
    await appendSheetRow(uiSettings.sharedRecordsId, "achievements!A:H", [row]);
  },

  async updateAchievement(id: string, data: Partial<AchievementRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "achievements!A:H");
    const rowIndex = rows.findIndex((r) => (r[ACHIEVEMENT_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Achievement not found");
    }
    const actualRow = rowIndex + 1;
    const newRow = [...rows[rowIndex]];
    if (data.creatorId !== undefined) {
      newRow[ACHIEVEMENT_COL.CREATOR_ID] = data.creatorId;
    }
    if (data.name !== undefined) {
      newRow[ACHIEVEMENT_COL.NAME] = data.name;
    }
    if (data.description !== undefined) {
      newRow[ACHIEVEMENT_COL.DESCRIPTION] = data.description;
    }
    if (data.icon !== undefined) {
      newRow[ACHIEVEMENT_COL.ICON] = data.icon;
    }
    if (data.extraUrl !== undefined) {
      newRow[ACHIEVEMENT_COL.EXTRA_URL] = data.extraUrl;
    }
    if (data.term !== undefined) {
      newRow[ACHIEVEMENT_COL.TERM] = data.term;
    }
    if (data.points !== undefined) {
      newRow[ACHIEVEMENT_COL.POINTS] = String(data.points);
    }
    await updateSheetValue(uiSettings.sharedRecordsId, `achievements!A${actualRow}:H${actualRow}`, [
      newRow
    ]);
  },

  async deleteAchievement(id: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "achievements!A:H");
    const rowIndex = rows.findIndex((r) => (r[ACHIEVEMENT_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Achievement not found");
    }
    await deleteSheetRow(uiSettings.sharedRecordsId, "achievements", rowIndex);
  },

  async awardAchievement(data: Partial<AchievementLogRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const row = new Array(6).fill("");
    row[ACHIEVEMENT_RECORD_COL.ID] = data.id || crypto.randomUUID();
    row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] = data.recorderId || "";
    row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] = data.accountId || "";
    row[ACHIEVEMENT_RECORD_COL.DATE] = data.date || getLocalDateString();
    row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] = data.achievementId || "";
    row[ACHIEVEMENT_RECORD_COL.TERM] = data.term || "";
    await appendSheetRow(uiSettings.sharedRecordsId, "achievement_records!A:F", [row]);
  },

  async revokeAchievement(logId: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "achievement_records!A:F");
    const rowIndex = rows.findIndex((r) => (r[ACHIEVEMENT_RECORD_COL.ID] || "").trim() === logId);
    if (rowIndex === -1) {
      throw new Error("Achievement log not found");
    }
    await deleteSheetRow(uiSettings.sharedRecordsId, "achievement_records", rowIndex);
  },

  async awardAchievementBatch(records: Partial<AchievementLogRecord>[]): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = records.map((data) => {
      const row = new Array(6).fill("");
      row[ACHIEVEMENT_RECORD_COL.ID] = data.id || crypto.randomUUID();
      row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] = data.recorderId || "";
      row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] = data.accountId || "";
      row[ACHIEVEMENT_RECORD_COL.DATE] = data.date || getLocalDateString();
      row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] = data.achievementId || "";
      row[ACHIEVEMENT_RECORD_COL.TERM] = data.term || "";
      return row;
    });
    await appendSheetRow(uiSettings.sharedRecordsId, "achievement_records!A:F", rows);
  }
};
