import { uiSettings } from "$state/settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow,
  deleteSheetRow
} from "$api/services/google-sheets-service";
import { fetchServer } from "$utils/api-client";
import {
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  type AchievementRecord,
  type AchievementLogRecord
} from "$lib/types";

/**
 * Resident API Methods (Proxy via server API)
 */
export async function fetchAchievements(forceRefresh = false): Promise<{
  achievements: AchievementRecord[];
  logs: AchievementLogRecord[];
  currentResidentId: string;
}> {
  const data = await fetchServer("/api/resident/achievements", {}, forceRefresh);
  return {
    achievements: data.achievements,
    logs: data.logs,
    currentResidentId: data.currentResidentId
  };
}

export function formatAwardDate(dateStr: string): string {
  if (!dateStr) {
    return "—";
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    if (dateStr.includes("T") || dateStr.includes(" ")) {
      return date.toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    }
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

export function calculateAchievementPercentage(
  earnersCount: number,
  totalEligibleCount: number
): number {
  if (totalEligibleCount <= 0) {
    return 0;
  }
  return Math.round((earnersCount / totalEligibleCount) * 100);
}

export function getEligibleCount(
  term: string | undefined,
  residentsCount: number,
  usersCount: number
): number {
  if (term) {
    return residentsCount;
  }
  return usersCount;
}

/**
 * Admin Direct Methods (Direct Google Sheets API)
 */
export async function fetchAdminAchievements(forceRefresh = false): Promise<AchievementRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    return [];
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievements!A:H", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[ACHIEVEMENT_COL.ID] || "").trim(),
    creatorId: (row[ACHIEVEMENT_COL.CREATOR_ID] || "").trim(),
    name: (row[ACHIEVEMENT_COL.NAME] || "").trim(),
    description: (row[ACHIEVEMENT_COL.DESCRIPTION] || "").trim(),
    icon: (row[ACHIEVEMENT_COL.ICON] || "").trim(),
    extraUrl: (row[ACHIEVEMENT_COL.EXTRA_URL] || "").trim(),
    term: (row[ACHIEVEMENT_COL.TERM] || "").trim(),
    points: parseInt(row[ACHIEVEMENT_COL.POINTS]) || 0,
    raw: row
  }));
}

export async function fetchAchievementLogs(forceRefresh = false): Promise<AchievementLogRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    return [];
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievement_records!A:F", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[ACHIEVEMENT_RECORD_COL.ID] || "").trim(),
    recorderId: (row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] || "").trim(),
    accountId: (row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] || "").trim(),
    date: (row[ACHIEVEMENT_RECORD_COL.DATE] || "").trim(),
    achievementId: (row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] || "").trim(),
    term: (row[ACHIEVEMENT_RECORD_COL.TERM] || "").trim(),
    raw: row
  }));
}

export async function addAchievement(data: Omit<AchievementRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const row = new Array(8).fill("");
  row[ACHIEVEMENT_COL.ID] = data.id || crypto.randomUUID();
  row[ACHIEVEMENT_COL.CREATOR_ID] = data.creatorId;
  row[ACHIEVEMENT_COL.NAME] = data.name;
  row[ACHIEVEMENT_COL.DESCRIPTION] = data.description;
  row[ACHIEVEMENT_COL.ICON] = data.icon;
  row[ACHIEVEMENT_COL.EXTRA_URL] = data.extraUrl || "";
  row[ACHIEVEMENT_COL.TERM] = data.term || "";
  row[ACHIEVEMENT_COL.POINTS] = String(data.points || 0);

  await appendSheetRow(spreadsheetId, "achievements!A:H", [row]);
}

export async function updateAchievement(id: string, data: Partial<AchievementRecord>) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievements!A:H");
  const rowIndex = rows.findIndex((r) => (r[ACHIEVEMENT_COL.ID] || "").trim() === id);
  if (rowIndex === -1) {
    throw new Error("Achievement not found");
  }

  const actualRow = rowIndex + 1;
  const currentRow = rows[rowIndex];
  const newRow = [...currentRow];

  while (newRow.length < 8) {
    newRow.push("");
  }

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

  await updateSheetValue(spreadsheetId, `achievements!A${actualRow}:H${actualRow}`, [newRow]);
}

export async function deleteAchievement(id: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievements!A:G");
  const rowIndex = rows.findIndex((r) => (r[ACHIEVEMENT_COL.ID] || "").trim() === id);
  if (rowIndex === -1) {
    throw new Error("Achievement not found");
  }

  await deleteSheetRow(spreadsheetId, "achievements", rowIndex);
}

export async function awardAchievement(data: Omit<AchievementLogRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const currentLogs = await fetchAchievementLogs(true);
  const isDuplicate = currentLogs.some(
    (l) => l.accountId === data.accountId && l.achievementId === data.achievementId
  );

  if (isDuplicate) {
    throw new Error("Achievement already granted to this account.");
  }

  const row = new Array(6).fill("");
  row[ACHIEVEMENT_RECORD_COL.ID] = data.id || crypto.randomUUID();
  row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] = data.recorderId;
  row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] = data.accountId;
  row[ACHIEVEMENT_RECORD_COL.DATE] = data.date || new Date().toISOString();
  row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] = data.achievementId;
  row[ACHIEVEMENT_RECORD_COL.TERM] = data.term || "";

  await appendSheetRow(spreadsheetId, "achievement_records!A:F", [row]);
}

export async function revokeAchievement(logId: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievement_records!A:F");
  const rowIndex = rows.findIndex((r) => (r[ACHIEVEMENT_RECORD_COL.ID] || "").trim() === logId);
  if (rowIndex === -1) {
    throw new Error("Achievement log not found");
  }

  await deleteSheetRow(spreadsheetId, "achievement_records", rowIndex);
}

export async function awardAchievementBatch(records: Omit<AchievementLogRecord, "raw">[]) {
  if (records.length === 0) {
    return;
  }
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const currentLogs = await fetchAchievementLogs(true);
  const rows = [];

  for (const data of records) {
    const isDuplicate = currentLogs.some(
      (l) => l.accountId === data.accountId && l.achievementId === data.achievementId
    );
    if (isDuplicate) {
      continue;
    }
    const row = new Array(6).fill("");
    row[ACHIEVEMENT_RECORD_COL.ID] = data.id || crypto.randomUUID();
    row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] = data.recorderId;
    row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] = data.accountId;
    row[ACHIEVEMENT_RECORD_COL.DATE] = data.date || new Date().toISOString();
    row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] = data.achievementId;
    row[ACHIEVEMENT_RECORD_COL.TERM] = data.term || "";
    rows.push(row);
  }

  if (rows.length > 0) {
    await appendSheetRow(spreadsheetId, "achievement_records!A:F", rows);
  }
}
