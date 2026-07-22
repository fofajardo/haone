import dayjs from "dayjs";
import { uiSettings } from "$state/settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow,
  deleteSheetRow
} from "$api/services/google-sheets-service";
import { fetchServer } from "$utils/api-client";
import { extractImageIds } from "$utils/image-utils";
import { ANNOUNCEMENT_COL, type AnnouncementRecord, AnnouncementStatus } from "$lib/types";

export function getAnnouncementStatus(a: AnnouncementRecord) {
  const now = dayjs();
  const start = a.startDate ? dayjs(a.startDate) : null;
  const expiry = a.expiryDate ? dayjs(a.expiryDate) : null;

  if (start && start.isAfter(now)) {
    return AnnouncementStatus.FUTURE;
  }
  if (a.isIndefinite) {
    return AnnouncementStatus.ACTIVE;
  }
  if (!expiry || expiry.isAfter(now) || expiry.isSame(now)) {
    return AnnouncementStatus.ACTIVE;
  }
  return AnnouncementStatus.EXPIRED;
}

export function isAnnouncementActive(a: AnnouncementRecord) {
  return getAnnouncementStatus(a) === AnnouncementStatus.ACTIVE;
}

/**
 * Resident API Methods (Proxy via server API)
 */
export async function fetchAnnouncements(forceRefresh = false): Promise<AnnouncementRecord[]> {
  return await fetchServer("/api/resident/announcements", {}, forceRefresh);
}

export async function fetchAnnouncementBySlug(
  slug: string,
  forceRefresh = false
): Promise<AnnouncementRecord> {
  return await fetchServer(
    `/api/resident/announcements?slug=${encodeURIComponent(slug)}`,
    {},
    forceRefresh
  );
}

/**
 * Admin Direct Methods (Direct Google Sheets API)
 */
export async function fetchAdminAnnouncements(forceRefresh = false): Promise<AnnouncementRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    return [];
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:L", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[ANNOUNCEMENT_COL.ID] || "").trim(),
    creatorId: (row[ANNOUNCEMENT_COL.CREATOR_ID] || "").trim(),
    dateCreated: (row[ANNOUNCEMENT_COL.DATE_CREATED] || "").trim(),
    startDate: (row[ANNOUNCEMENT_COL.START_DATE] || "").trim(),
    expiryDate: (row[ANNOUNCEMENT_COL.EXPIRY_DATE] || "").trim(),
    isIndefinite: (row[ANNOUNCEMENT_COL.IS_INDEFINITE] || "").toUpperCase() === "TRUE",
    isAdminOnly: (row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] || "").toUpperCase() === "TRUE",
    isUnlisted: (row[ANNOUNCEMENT_COL.IS_UNLISTED] || "").toUpperCase() === "TRUE",
    slug: (row[ANNOUNCEMENT_COL.SLUG] || "").trim(),
    tags: (row[ANNOUNCEMENT_COL.TAGS] || "").trim(),
    title: (row[ANNOUNCEMENT_COL.TITLE] || "").trim(),
    content: (row[ANNOUNCEMENT_COL.CONTENT] || "").trim(),
    broadcastCount: parseInt(row[ANNOUNCEMENT_COL.BROADCAST_COUNT]) || 0,
    raw: row
  }));
}

export async function addAnnouncement(data: Omit<AnnouncementRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const all = await fetchAdminAnnouncements();
  if (all.some((a) => a.slug === data.slug)) {
    throw new Error(`Slug "${data.slug}" is already in use`);
  }

  const row = new Array(13).fill("");
  row[ANNOUNCEMENT_COL.ID] = data.id || crypto.randomUUID();
  row[ANNOUNCEMENT_COL.CREATOR_ID] = data.creatorId;
  row[ANNOUNCEMENT_COL.DATE_CREATED] = new Date().toISOString();
  row[ANNOUNCEMENT_COL.START_DATE] = data.startDate;
  row[ANNOUNCEMENT_COL.EXPIRY_DATE] = data.expiryDate;
  row[ANNOUNCEMENT_COL.IS_INDEFINITE] = String(data.isIndefinite).toUpperCase();
  row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = String(data.isAdminOnly).toUpperCase();
  row[ANNOUNCEMENT_COL.IS_UNLISTED] = String(data.isUnlisted).toUpperCase();
  row[ANNOUNCEMENT_COL.TAGS] = data.tags;
  row[ANNOUNCEMENT_COL.TITLE] = data.title;
  row[ANNOUNCEMENT_COL.CONTENT] = data.content;
  row[ANNOUNCEMENT_COL.SLUG] = data.slug;
  row[ANNOUNCEMENT_COL.BROADCAST_COUNT] = "0";

  await appendSheetRow(spreadsheetId, "announcements!A:M", [row]);
}

export async function updateAnnouncement(id: string, data: Partial<AnnouncementRecord>) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:L");
  const rowIndex = rows.findIndex((r) => (r[ANNOUNCEMENT_COL.ID] || "").trim() === id);
  if (rowIndex === -1) {
    throw new Error("Announcement not found");
  }

  if (data.slug !== undefined) {
    const all = await fetchAdminAnnouncements();
    if (all.some((a) => a.slug === data.slug && a.id !== id)) {
      throw new Error(`Slug "${data.slug}" is already in use`);
    }
  }

  const actualRow = rowIndex + 1;
  const currentRow = rows[rowIndex];
  const newRow = [...currentRow];

  while (newRow.length < 13) {
    newRow.push("");
  }

  if (data.startDate !== undefined) {
    newRow[ANNOUNCEMENT_COL.START_DATE] = data.startDate;
  }
  if (data.expiryDate !== undefined) {
    newRow[ANNOUNCEMENT_COL.EXPIRY_DATE] = data.expiryDate;
  }
  if (data.isIndefinite !== undefined) {
    newRow[ANNOUNCEMENT_COL.IS_INDEFINITE] = String(data.isIndefinite).toUpperCase();
  }
  if (data.isAdminOnly !== undefined) {
    newRow[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = String(data.isAdminOnly).toUpperCase();
  }
  if (data.isUnlisted !== undefined) {
    newRow[ANNOUNCEMENT_COL.IS_UNLISTED] = String(data.isUnlisted).toUpperCase();
  }
  if (data.tags !== undefined) {
    newRow[ANNOUNCEMENT_COL.TAGS] = data.tags;
  }
  if (data.title !== undefined) {
    newRow[ANNOUNCEMENT_COL.TITLE] = data.title;
  }
  if (data.content !== undefined) {
    newRow[ANNOUNCEMENT_COL.CONTENT] = data.content;
  }
  if (data.slug !== undefined) {
    newRow[ANNOUNCEMENT_COL.SLUG] = data.slug;
  }
  if (data.broadcastCount !== undefined) {
    newRow[ANNOUNCEMENT_COL.BROADCAST_COUNT] = String(data.broadcastCount);
  }

  await updateSheetValue(spreadsheetId, `announcements!A${actualRow}:M${actualRow}`, [newRow]);
}

export async function expireAnnouncement(id: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:J");
  const rowIndex = rows.findIndex((r) => r[ANNOUNCEMENT_COL.ID] === id);
  if (rowIndex === -1) {
    throw new Error("Announcement not found");
  }

  const actualRow = rowIndex + 1;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await Promise.all([
    updateSheetValue(spreadsheetId, `announcements!E${actualRow}`, [
      [yesterday.toISOString().split("T")[0]]
    ]),
    updateSheetValue(spreadsheetId, `announcements!F${actualRow}`, [["FALSE"]])
  ]);
}

export async function deleteAnnouncement(id: string, accessToken: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:L");
  const rowIndex = rows.findIndex((r) => (r[ANNOUNCEMENT_COL.ID] || "").trim() === id);
  if (rowIndex === -1) {
    throw new Error("Announcement not found");
  }

  const content = rows[rowIndex][ANNOUNCEMENT_COL.CONTENT] || "";
  const imageIds = extractImageIds(content);

  await deleteSheetRow(spreadsheetId, "announcements", rowIndex);
}
