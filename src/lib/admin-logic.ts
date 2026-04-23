import { uiSettings } from "./settings.svelte";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow } from "./google-sheets";
import {
  LAUNDRY_COL,
  PAYMENT_REQUEST_COL,
  ANNOUNCEMENT_COL,
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  JOURNAL_COL,
  type LaundryRecord,
  type PaymentRequestRecord,
  type AnnouncementRecord,
  type AchievementRecord,
  type AchievementLogRecord,
  PaymentRequestStatus,
  AnnouncementStatus
} from "./schemas";
import { parseAmount } from "./resident-logic";
import { parseTime } from "./receipt-utils";

/**
 * Laundry Reservations
 */
export async function fetchLaundryReservations(forceRefresh = false): Promise<LaundryRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetRowsRaw(spreadsheetId, "laundry!A:I", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[LAUNDRY_COL.ID] || "").trim(),
    residentId: (row[LAUNDRY_COL.RESIDENT_ID] || "").trim(),
    date: (row[LAUNDRY_COL.DATE] || "").trim(),
    timeStart: (row[LAUNDRY_COL.TIME_START] || "").trim(),
    timeEnd: (row[LAUNDRY_COL.TIME_END] || "").trim(),
    status: (row[LAUNDRY_COL.STATUS] || "").trim(),
    cancelReason: (row[LAUNDRY_COL.CANCEL_REASON] || "").trim(),
    creationTimestamp: (row[LAUNDRY_COL.CREATION_TIMESTAMP] || "").trim(),
    cancelTimestamp: (row[LAUNDRY_COL.CANCEL_TIMESTAMP] || "").trim(),
    raw: row
  }));
}

export async function addLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const startH = parseTime(data.timeStart);
  const endH = parseTime(data.timeEnd);
  const [y, m, d] = data.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, startH);
  const end = new Date(y, m - 1, d, endH);

  if (start >= end) throw new Error("Start time must be before end time.");

  const opStart = 5;
  const opEnd = 22;
  if (
    start.getHours() < opStart ||
    end.getHours() > opEnd ||
    (end.getHours() === opEnd && end.getMinutes() > 0)
  ) {
    throw new Error("Laundry facility is only open from 5:00 AM to 10:00 PM.");
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs > 2 * 60 * 60 * 1000)
    throw new Error("Maximum of two (2) hours for any reservation.");

  // Overlap Check
  const existing = await fetchLaundryReservations(true);
  const isOverlapping = existing.some((r) => {
    if (r.status !== "ACTIVE" || r.date !== data.date) return false;
    const rStart = new Date(`${r.date}T${r.timeStart}`);
    const rEnd = new Date(`${r.date}T${r.timeEnd}`);
    return start < rEnd && end > rStart;
  });

  if (isOverlapping) throw new Error("This slot overlaps with an existing reservation.");

  const row = new Array(9).fill("");
  row[LAUNDRY_COL.ID] = data.id || crypto.randomUUID();
  row[LAUNDRY_COL.RESIDENT_ID] = data.residentId;
  row[LAUNDRY_COL.DATE] = data.date;
  row[LAUNDRY_COL.TIME_START] = data.timeStart;
  row[LAUNDRY_COL.TIME_END] = data.timeEnd;
  row[LAUNDRY_COL.STATUS] = data.status || "ACTIVE";
  row[LAUNDRY_COL.CANCEL_REASON] = data.cancelReason || "";
  row[LAUNDRY_COL.CREATION_TIMESTAMP] = new Date().toISOString();
  row[LAUNDRY_COL.CANCEL_TIMESTAMP] = "";

  await appendSheetRow(spreadsheetId, "laundry!A:I", [row]);
}

export async function cancelLaundryReservation(
  reservationId: string,
  reason: string,
  status: "CANCELLED_BY_USER" | "CANCELLED_BY_ADMIN" = "CANCELLED_BY_ADMIN"
) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const rows = await fetchSheetRowsRaw(spreadsheetId, "laundry!A:I");
  const rowIndex = rows.findIndex((r) => (r[LAUNDRY_COL.ID] || "").trim() === reservationId);
  if (rowIndex === -1) throw new Error("Reservation not found");

  const actualRow = rowIndex + 1;
  await Promise.all([
    updateSheetValue(spreadsheetId, `laundry!F${actualRow}`, [[status]]),
    updateSheetValue(spreadsheetId, `laundry!G${actualRow}`, [[reason]]),
    updateSheetValue(spreadsheetId, `laundry!I${actualRow}`, [[new Date().toISOString()]])
  ]);
}

/**
 * Payment Management
 */
export async function fetchPaymentRequests(forceRefresh = false): Promise<PaymentRequestRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:L", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[PAYMENT_REQUEST_COL.ID] || "").trim(),
    residentId: (row[PAYMENT_REQUEST_COL.RESIDENT_ID] || "").trim(),
    date: (row[PAYMENT_REQUEST_COL.DATE] || "").trim(),
    waterFee: parseAmount(row[PAYMENT_REQUEST_COL.WATER_FEE]),
    assocFee: parseAmount(row[PAYMENT_REQUEST_COL.ASSOC_FEE]),
    misc: parseAmount(row[PAYMENT_REQUEST_COL.MISC]),
    mop: (row[PAYMENT_REQUEST_COL.MOP] || "").trim(),
    type: (row[PAYMENT_REQUEST_COL.TYPE] || "").trim(),
    proofLink: (row[PAYMENT_REQUEST_COL.PROOF_LINK] || "").trim(),
    status: (row[PAYMENT_REQUEST_COL.STATUS] || PaymentRequestStatus.PENDING).trim().toUpperCase(),
    notes: (row[PAYMENT_REQUEST_COL.NOTES] || "").trim(),
    statusReason: (row[PAYMENT_REQUEST_COL.STATUS_REASON] || "").trim(),
    raw: row
  }));
}

export async function approvePaymentRequest(
  paymentId: string,
  journalData: {
    date: string;
    creator: string;
    account: string;
    water: number;
    assoc: number;
    misc: number;
    mop: string;
    period: string;
    type: string;
    notes: string;
    mopRefNo: string;
    creatorName: string;
    name: string;
    stno: string;
  }
) {
  const srId = uiSettings.sharedRecordsId;
  const awId = uiSettings.accountingWorkbookId;
  if (!srId || !awId) throw new Error("Spreadsheet IDs not configured");

  const srRows = await fetchSheetRowsRaw(srId, "payment_requests!A:L");
  const rowIndex = srRows.findIndex((r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === paymentId);
  if (rowIndex === -1) throw new Error("Payment record not found");

  const actualRow = rowIndex + 1;
  const jRow = new Array(20).fill("");
  jRow[JOURNAL_COL.DATE] = journalData.date;
  jRow[JOURNAL_COL.CREATOR] = journalData.creator;
  jRow[JOURNAL_COL.ACCOUNT] = journalData.account;
  jRow[JOURNAL_COL.WATER] = journalData.water;
  jRow[JOURNAL_COL.ASSOC] = journalData.assoc;
  jRow[JOURNAL_COL.MISC] = journalData.misc;
  jRow[JOURNAL_COL.MOP] = journalData.mop;
  jRow[JOURNAL_COL.PERIOD] = journalData.period;
  jRow[JOURNAL_COL.TYPE] = journalData.type;
  jRow[JOURNAL_COL.NOTES] = journalData.notes;
  jRow[JOURNAL_COL.MOP_REFNO] = journalData.mopRefNo;
  jRow[JOURNAL_COL.CREATOR_NAME] = journalData.creatorName;
  jRow[JOURNAL_COL.NAME] = journalData.name;
  jRow[JOURNAL_COL.STNO] = journalData.stno;
  jRow[JOURNAL_COL.WAS_AUDITED] = "FALSE";
  jRow[JOURNAL_COL.ID] = crypto.randomUUID();

  await Promise.all([
    updateSheetValue(srId, `payment_requests!J${actualRow}`, [[PaymentRequestStatus.APPROVED]]),
    appendSheetRow(awId, "journal_general!A:T", [jRow])
  ]);
}

export async function declinePaymentRequest(paymentId: string, reason: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:L");
  const rowIndex = rows.findIndex((r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === paymentId);
  if (rowIndex === -1) throw new Error("Payment record not found");

  const actualRow = rowIndex + 1;
  await Promise.all([
    updateSheetValue(spreadsheetId, `payment_requests!J${actualRow}`, [
      [PaymentRequestStatus.DECLINED]
    ]),
    updateSheetValue(spreadsheetId, `payment_requests!L${actualRow}`, [[reason]])
  ]);
}

/**
 * Announcements
 */
export async function fetchAnnouncements(forceRefresh = false): Promise<AnnouncementRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:J", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[ANNOUNCEMENT_COL.ID] || "").trim(),
    creatorId: (row[ANNOUNCEMENT_COL.CREATOR_ID] || "").trim(),
    dateCreated: (row[ANNOUNCEMENT_COL.DATE_CREATED] || "").trim(),
    startDate: (row[ANNOUNCEMENT_COL.START_DATE] || "").trim(),
    expiryDate: (row[ANNOUNCEMENT_COL.EXPIRY_DATE] || "").trim(),
    isIndefinite: (row[ANNOUNCEMENT_COL.IS_INDEFINITE] || "").toUpperCase() === "TRUE",
    isAdminOnly: (row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] || "").toUpperCase() === "TRUE",
    tags: (row[ANNOUNCEMENT_COL.TAGS] || "").trim(),
    title: (row[ANNOUNCEMENT_COL.TITLE] || "").trim(),
    content: (row[ANNOUNCEMENT_COL.CONTENT] || "").trim(),
    raw: row
  }));
}

export async function addAnnouncement(data: Omit<AnnouncementRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const row = new Array(10).fill("");
  row[ANNOUNCEMENT_COL.ID] = data.id || crypto.randomUUID();
  row[ANNOUNCEMENT_COL.CREATOR_ID] = data.creatorId;
  row[ANNOUNCEMENT_COL.DATE_CREATED] = new Date().toISOString();
  row[ANNOUNCEMENT_COL.START_DATE] = data.startDate;
  row[ANNOUNCEMENT_COL.EXPIRY_DATE] = data.expiryDate;
  row[ANNOUNCEMENT_COL.IS_INDEFINITE] = String(data.isIndefinite).toUpperCase();
  row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = String(data.isAdminOnly).toUpperCase();
  row[ANNOUNCEMENT_COL.TAGS] = data.tags;
  row[ANNOUNCEMENT_COL.TITLE] = data.title;
  row[ANNOUNCEMENT_COL.CONTENT] = data.content;

  await appendSheetRow(spreadsheetId, "announcements!A:J", [row]);
}

export async function updateAnnouncement(id: string, data: Partial<AnnouncementRecord>) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:J");
  const rowIndex = rows.findIndex((r) => r[ANNOUNCEMENT_COL.ID] === id);
  if (rowIndex === -1) throw new Error("Announcement not found");

  const actualRow = rowIndex + 1;
  const currentRow = rows[rowIndex];
  const newRow = [...currentRow];

  if (data.startDate !== undefined) newRow[ANNOUNCEMENT_COL.START_DATE] = data.startDate;
  if (data.expiryDate !== undefined) newRow[ANNOUNCEMENT_COL.EXPIRY_DATE] = data.expiryDate;
  if (data.isIndefinite !== undefined)
    newRow[ANNOUNCEMENT_COL.IS_INDEFINITE] = String(data.isIndefinite).toUpperCase();
  if (data.isAdminOnly !== undefined)
    newRow[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = String(data.isAdminOnly).toUpperCase();
  if (data.tags !== undefined) newRow[ANNOUNCEMENT_COL.TAGS] = data.tags;
  if (data.title !== undefined) newRow[ANNOUNCEMENT_COL.TITLE] = data.title;
  if (data.content !== undefined) newRow[ANNOUNCEMENT_COL.CONTENT] = data.content;

  await updateSheetValue(spreadsheetId, `announcements!A${actualRow}:J${actualRow}`, [newRow]);
}

export async function expireAnnouncement(id: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:J");
  const rowIndex = rows.findIndex((r) => r[ANNOUNCEMENT_COL.ID] === id);
  if (rowIndex === -1) throw new Error("Announcement not found");

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

/**
 * Achievements
 */
export async function fetchAchievements(forceRefresh = false): Promise<AchievementRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievements!A:F", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[ACHIEVEMENT_COL.ID] || "").trim(),
    creatorId: (row[ACHIEVEMENT_COL.CREATOR_ID] || "").trim(),
    name: (row[ACHIEVEMENT_COL.NAME] || "").trim(),
    description: (row[ACHIEVEMENT_COL.DESCRIPTION] || "").trim(),
    icon: (row[ACHIEVEMENT_COL.ICON] || "").trim(),
    extraUrl: (row[ACHIEVEMENT_COL.EXTRA_URL] || "").trim(),
    raw: row
  }));
}

export async function fetchAchievementLogs(forceRefresh = false): Promise<AchievementLogRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetRowsRaw(spreadsheetId, "achievement_records!A:E", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[ACHIEVEMENT_RECORD_COL.ID] || "").trim(),
    recorderId: (row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] || "").trim(),
    accountId: (row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] || "").trim(),
    date: (row[ACHIEVEMENT_RECORD_COL.DATE] || "").trim(),
    achievementId: (row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] || "").trim(),
    raw: row
  }));
}

export async function addAchievement(data: Omit<AchievementRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const row = new Array(6).fill("");
  row[ACHIEVEMENT_COL.ID] = data.id || crypto.randomUUID();
  row[ACHIEVEMENT_COL.CREATOR_ID] = data.creatorId;
  row[ACHIEVEMENT_COL.NAME] = data.name;
  row[ACHIEVEMENT_COL.DESCRIPTION] = data.description;
  row[ACHIEVEMENT_COL.ICON] = data.icon;
  row[ACHIEVEMENT_COL.EXTRA_URL] = data.extraUrl;

  await appendSheetRow(spreadsheetId, "achievements!A:F", [row]);
}

export async function awardAchievement(data: Omit<AchievementLogRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const row = new Array(5).fill("");
  row[ACHIEVEMENT_RECORD_COL.ID] = data.id || crypto.randomUUID();
  row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] = data.recorderId;
  row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] = data.accountId;
  row[ACHIEVEMENT_RECORD_COL.DATE] = data.date || new Date().toISOString().split("T")[0];
  row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] = data.achievementId;

  await appendSheetRow(spreadsheetId, "achievement_records!A:E", [row]);
}

/**
 * Announcement Helpers
 */
export function getAnnouncementStatus(a: AnnouncementRecord) {
  const now = new Date().toISOString().split("T")[0];
  if (a.startDate > now) return AnnouncementStatus.FUTURE;
  if (a.isIndefinite) return AnnouncementStatus.ACTIVE;
  return a.expiryDate >= now ? AnnouncementStatus.ACTIVE : AnnouncementStatus.EXPIRED;
}
