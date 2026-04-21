import { uiSettings } from "./settings.svelte";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow } from "./google-sheets";
import {
  LAUNDRY_COL,
  PAYMENT_REQUEST_COL,
  ANNOUNCEMENT_COL,
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  USER_SETTINGS_COL,
  type LaundryRecord,
  type PaymentRequestRecord,
  type AnnouncementRecord,
  type AchievementRecord,
  type AchievementLogRecord,
  type UserSettingsRecord,
  PaymentRequestStatus
} from "./schemas";
import { parseAmount } from "./resident-logic";
import { parseTime } from "./receipt-utils";
import { auth } from "./auth.svelte";
import { fetchServer } from "./utils";

/**
 * Laundry Reservations
 */
export async function fetchLaundryReservations(
  forceRefresh = false
): Promise<LaundryRecord[] | { reservations: LaundryRecord[]; currentResidentId: string }> {
  if (auth.authType === "resident") {
    const data = await fetchServer("/api/resident/laundry");
    return {
      reservations: data.reservations,
      currentResidentId: data.currentResidentId
    };
  }

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
  if (auth.authType === "resident") {
    return await fetchServer("/api/resident/laundry", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const startH = parseTime(data.timeStart);
  const endH = parseTime(data.timeEnd);
  const [y, m, d] = data.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, startH);
  const end = new Date(y, m - 1, d, endH);
  const now = new Date();

  // 1. Basic Order
  if (start >= end) {
    throw new Error("Start time must be before end time.");
  }

  // 2. Past Date Check
  if (start < now) {
    throw new Error("Cannot reserve for a past time.");
  }

  // 3. Operating Hours (5 AM - 10 PM)
  const opStart = 5;
  const opEnd = 22; // Closes at 10 PM
  if (
    start.getHours() < opStart ||
    end.getHours() > opEnd ||
    (end.getHours() === opEnd && end.getMinutes() > 0)
  ) {
    throw new Error("Laundry facility is only open from 5:00 AM to 10:00 PM.");
  }

  // 4. Max 2 hours
  const durationMs = end.getTime() - start.getTime();
  if (durationMs > 2 * 60 * 60 * 1000) {
    throw new Error("Maximum of two (2) hours for any reservation.");
  }

  // 4. Max 2 weeks in advance
  const maxAdvance = new Date();
  maxAdvance.setDate(now.getDate() + 14);
  if (start > maxAdvance) {
    throw new Error("Maximum of two (2) weeks space for reservation.");
  }

  // 5. Overlap Check
  const resResult = await fetchLaundryReservations(true);
  const existing = Array.isArray(resResult) ? resResult : resResult.reservations;
  const isOverlapping = existing.some((r) => {
    if (r.status !== "ACTIVE" || r.date !== data.date) return false;
    const rStart = new Date(`${r.date}T${r.timeStart}`);
    const rEnd = new Date(`${r.date}T${r.timeEnd}`);
    // (StartA < EndB) and (EndA > StartB)
    return start < rEnd && end > rStart;
  });

  if (isOverlapping) {
    throw new Error("This slot overlaps with an existing reservation.");
  }

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
  status: "CANCELLED_BY_USER" | "CANCELLED_BY_ADMIN" = "CANCELLED_BY_USER"
) {
  if (auth.authType === "resident") {
    return await fetchServer(`/api/resident/laundry?id=${reservationId}`, {
      method: "DELETE"
    });
  }

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
 * Self-service Payments
 */
export async function fetchPaymentRequests(
  forceRefresh = false
): Promise<
  PaymentRequestRecord[] | { requests: PaymentRequestRecord[]; currentResidentId: string }
> {
  if (auth.authType === "resident") {
    const data = await fetchServer("/api/resident/payment-requests");
    return {
      requests: data.requests,
      currentResidentId: data.currentResidentId
    };
  }

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
    status: (row[PAYMENT_REQUEST_COL.STATUS] || PaymentRequestStatus.PENDING).trim(),
    notes: (row[PAYMENT_REQUEST_COL.NOTES] || "").trim(),
    statusReason: (row[PAYMENT_REQUEST_COL.STATUS_REASON] || "").trim(),
    raw: row
  }));
}

export async function addPaymentRequest(data: Omit<PaymentRequestRecord, "raw">) {
  if (auth.authType === "resident") {
    return await fetchServer("/api/resident/payment-requests", {
      method: "POST",
      body: JSON.stringify(data)
    });
  }

  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const row = new Array(12).fill("");
  row[PAYMENT_REQUEST_COL.ID] = data.id || crypto.randomUUID();
  row[PAYMENT_REQUEST_COL.RESIDENT_ID] = data.residentId;
  row[PAYMENT_REQUEST_COL.DATE] = data.date;
  row[PAYMENT_REQUEST_COL.WATER_FEE] = data.waterFee;
  row[PAYMENT_REQUEST_COL.ASSOC_FEE] = data.assocFee;
  row[PAYMENT_REQUEST_COL.MISC] = data.misc;
  row[PAYMENT_REQUEST_COL.MOP] = data.mop;
  row[PAYMENT_REQUEST_COL.TYPE] = data.type || "COLLECTION";
  row[PAYMENT_REQUEST_COL.PROOF_LINK] = data.proofLink;
  row[PAYMENT_REQUEST_COL.STATUS] = PaymentRequestStatus.PENDING;
  row[PAYMENT_REQUEST_COL.NOTES] = data.notes || "";
  row[PAYMENT_REQUEST_COL.STATUS_REASON] = "";

  await appendSheetRow(spreadsheetId, "payment_requests!A:L", [row]);
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

  // 1. Mark as APPROVED in payment_requests
  const srRows = await fetchSheetRowsRaw(srId, "payment_requests!A:K");
  const rowIndex = srRows.findIndex((r) => r[PAYMENT_REQUEST_COL.ID] === paymentId);
  if (rowIndex === -1) throw new Error("Payment record not found");

  const actualRow = rowIndex + 1;

  // 2. Add to journal_general
  const { JOURNAL_COL } = await import("./schemas");
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

  const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:K");
  const rowIndex = rows.findIndex((r) => r[PAYMENT_REQUEST_COL.ID] === paymentId);
  if (rowIndex === -1) throw new Error("Payment record not found");

  const actualRow = rowIndex + 1;
  await Promise.all([
    updateSheetValue(spreadsheetId, `payment_requests!J${actualRow}`, [
      [PaymentRequestStatus.DECLINED]
    ]),
    updateSheetValue(spreadsheetId, `payment_requests!L${actualRow}`, [[reason]])
  ]);
}

export async function cancelPaymentRequest(paymentId: string) {
  if (auth.authType === "resident") {
    return await fetchServer(`/api/resident/payment-requests?id=${paymentId}`, {
      method: "DELETE"
    });
  }

  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:L");
  const rowIndex = rows.findIndex((r) => r[PAYMENT_REQUEST_COL.ID] === paymentId);
  if (rowIndex === -1) throw new Error("Payment record not found");

  if (rows[rowIndex][PAYMENT_REQUEST_COL.STATUS] !== PaymentRequestStatus.PENDING) {
    throw new Error("Only pending requests can be cancelled");
  }

  const actualRow = rowIndex + 1;
  await updateSheetValue(spreadsheetId, `payment_requests!J${actualRow}`, [
    [PaymentRequestStatus.CANCELLED]
  ]);
}

/**
 * Announcements
 */
export async function fetchAnnouncements(forceRefresh = false): Promise<AnnouncementRecord[]> {
  if (auth.authType === "resident") {
    return await fetchServer("/api/resident/announcements");
  }

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
export async function fetchAchievements(
  forceRefresh = false
): Promise<
  | AchievementRecord[]
  | { achievements: AchievementRecord[]; logs: AchievementLogRecord[]; currentResidentId: string }
> {
  if (auth.authType === "resident") {
    const data = await fetchServer("/api/resident/achievements");
    return {
      achievements: data.achievements,
      logs: data.logs,
      currentResidentId: data.currentResidentId
    };
  }

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

export async function fetchAchievementLogs(
  forceRefresh = false
): Promise<
  | AchievementLogRecord[]
  | { achievements: AchievementRecord[]; logs: AchievementLogRecord[]; currentResidentId: string }
> {
  if (auth.authType === "resident") {
    const data = await fetchServer("/api/resident/achievements");
    return {
      achievements: data.achievements,
      logs: data.logs,
      currentResidentId: data.currentResidentId
    };
  }

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
 * User Settings
 */
export async function fetchUserSettings(forceRefresh = false): Promise<UserSettingsRecord[]> {
  if (auth.authType === "resident") {
    const data = await fetchServer("/api/resident/settings");
    return [
      {
        residentId: auth.user?.email || "",
        isPublicAchievementList: data.isPublicAchievementList,
        raw: []
      }
    ];
  }

  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) return [];

  const rows = await fetchSheetRowsRaw(spreadsheetId, "settings!A:B", forceRefresh);
  return rows.slice(1).map((row) => ({
    residentId: (row[USER_SETTINGS_COL.RESIDENT_ID] || "").trim(),
    isPublicAchievementList:
      (row[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "").toUpperCase() === "TRUE",
    raw: row
  }));
}

export async function updateUserSettings(residentId: string, isPublic: boolean) {
  if (auth.authType === "resident") {
    return await fetchServer("/api/resident/settings", {
      method: "PATCH",
      body: JSON.stringify({ isPublicAchievementList: isPublic })
    });
  }

  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) throw new Error("Shared Records ID not configured");

  const rows = await fetchSheetRowsRaw(spreadsheetId, "settings!A:B");
  const rowIndex = rows.findIndex((r) => r[USER_SETTINGS_COL.RESIDENT_ID] === residentId);

  if (rowIndex === -1) {
    // New setting record
    const row = [residentId, String(isPublic).toUpperCase()];
    await appendSheetRow(spreadsheetId, "settings!A:B", [row]);
  } else {
    const actualRow = rowIndex + 1;
    await updateSheetValue(spreadsheetId, `settings!B${actualRow}`, [
      [String(isPublic).toUpperCase()]
    ]);
  }
}
