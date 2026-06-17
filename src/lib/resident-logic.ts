import { emailDispatcher } from "./dispatcher.svelte";
import { PaymentStatusTemplate } from "./templates/payment-status";
import { ClearanceCertificateTemplate } from "./templates/clearance";
import type { BrandingProfile } from "./templates/types";
import { goto } from "$app/navigation";
import { auth } from "./auth.svelte";
import { fetchServer } from "./utils";
import {
  ACCOUNT_COL,
  JOURNAL_COL,
  USER_COL,
  type ResidentRecord,
  type JournalRecord,
  type UserRecord
} from "./schemas";

/**
 * Robust financial parsing for spreadsheet values.
 * Handles currency symbols (₱), separators (,), and nulls.
 */
export function parseAmount(val: any): number {
  if (val === undefined || val === null) {
    return 0;
  }
  const str = String(val).trim().replace(/[₱,]/g, "");
  if (!str) {
    return 0;
  }

  // Check for (1,234.56) accounting format
  const isParenNegative = str.startsWith("(") && str.endsWith(")");
  const numericStr = isParenNegative ? str.slice(1, -1) : str;

  const parsed = parseFloat(numericStr);
  if (isNaN(parsed)) {
    return 0;
  }

  return isParenNegative ? -parsed : parsed;
}

/**
 * Maps a raw Google Sheets row to a typed ResidentRecord, optionally joining with user data.
 */
export function mapRowToResident(
  row: string[],
  userRow?: string[],
  financials?: any
): ResidentRecord {
  const waterBase = financials?.waterBase || 0;
  const waterPaid = financials?.waterPaid || 0;
  const waterWaived = financials?.waterWaived || 0;
  const assocBase = financials?.assocBase || 0;
  const assocPaid = financials?.assocPaid || 0;
  const assocWaived = financials?.assocWaived || 0;
  const paid = waterPaid + assocPaid + (financials?.miscPaid || 0);
  const waived = waterWaived + assocWaived;
  const totalBase = waterBase + assocBase;
  const bal = totalBase - paid - waived;

  return {
    raw: row,
    email: userRow ? (userRow[USER_COL.EMAIL] || "").trim() : "",
    period: (row[ACCOUNT_COL.PERIOD] || "").trim(),
    room: (row[ACCOUNT_COL.ROOM] || "").trim(),
    bed: (row[ACCOUNT_COL.BED] || "").trim(),
    name: userRow ? (userRow[USER_COL.DISPLAY_NAME] || "").trim() : "",
    stno: userRow ? (userRow[USER_COL.STUDENT_NO] || "").trim() : "",
    waterBase,
    waterPaid,
    waterWaived,
    waterBal: waterBase - waterPaid - waterWaived,
    assocBase,
    assocPaid,
    assocWaived,
    assocBal: assocBase - assocPaid - assocWaived,
    totalBase,
    paid,
    waived,
    bal,
    isFullyPaid: bal <= 0,
    ceRefNo: (row[ACCOUNT_COL.CE_REFNO] || "").trim(),
    ceIssued: (row[ACCOUNT_COL.CE_ISSUED] || "").trim(),
    ceLink: (row[ACCOUNT_COL.CE_LINK] || "").trim(),
    ceFullName: userRow ? (userRow[USER_COL.DISPLAY_NAME_FL] || "").trim() : "",
    notes: (row[ACCOUNT_COL.NOTES] || "").trim(),
    college: userRow ? (userRow[USER_COL.COLLEGE] || "").trim() : "",
    program: userRow ? (userRow[USER_COL.DEGREE_PROGRAM] || "").trim() : "",
    residentId: (row[ACCOUNT_COL.RESIDENT_ID] || "").trim(),
    ledgerId: (row[ACCOUNT_COL.ID] || "").trim(),
    checkInDate: (row[ACCOUNT_COL.CHECK_IN_DATE] || "").trim(),
    type: (row[ACCOUNT_COL.TYPE] || "").trim()
  };
}

/**
 * Fetches joined resident data from Accounts and ResidentRecords spreadsheets.
 */
export async function fetchResidents(forceRefresh = false): Promise<ResidentRecord[]> {
  if (auth.authType === "resident") {
    const data = await fetchServer("/api/resident/occupancy", {}, forceRefresh);
    return data.accounts;
  }

  const { uiSettings } = await import("./settings.svelte");
  const { fetchSheetRowsRaw } = await import("./google-sheets");

  if (!uiSettings.accountingWorkbookId || !uiSettings.residentRecordsId) {
    return [];
  }

  const [accRows, userRows, journalRows, constRows] = await Promise.all([
    fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L", forceRefresh),
    fetchSheetRowsRaw(uiSettings.residentRecordsId, "users!A:P", forceRefresh),
    fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "journal_general!A:T", forceRefresh),
    fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C", forceRefresh)
  ]);

  const userMap = new Map<string, string[]>();
  userRows.slice(1).forEach((row) => {
    const id = (row[USER_COL.ID] || "").trim();
    if (id) userMap.set(id, row);
  });

  const journal = journalRows.slice(1).map((r, idx) => mapRowToJournal(r, idx + 2));

  // Helper for constant lookups
  const getConst = (key: string) => constRows.find((r) => r[0] === key)?.[1] || "0";
  const pmtWaived = getConst("PMT_WAIVED") || "PMT_WAIVED";

  return accRows
    .slice(1)
    .map((row) => {
      const resId = (row[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const userRow = resId ? userMap.get(resId) : undefined;
      const period = (row[ACCOUNT_COL.PERIOD] || "").trim();
      const email = userRow ? (userRow[USER_COL.EMAIL] || "").trim().toLowerCase() : "";

      // Compute financials
      const filtered = journal.filter(
        (j) => (j.account || "").toLowerCase() === email && j.period === period
      );

      const waterPaid = filtered
        .filter((j) => j.type !== pmtWaived)
        .reduce((sum, j) => sum + j.water, 0);
      const waterWaived = filtered
        .filter((j) => j.type === pmtWaived)
        .reduce((sum, j) => sum + j.water, 0);

      const assocPaid = filtered
        .filter((j) => j.type !== pmtWaived)
        .reduce((sum, j) => sum + j.assoc, 0);
      const assocWaived = filtered
        .filter((j) => j.type === pmtWaived)
        .reduce((sum, j) => sum + j.assoc, 0);

      const miscPaid = filtered.reduce((sum, j) => sum + j.misc, 0);

      // Sourced from constants with period prefix
      const waterBase = parseAmount(getConst(`FEES_${period}_WATER`));
      const assocBase = parseAmount(getConst(`FEES_${period}_ASSOC`));

      const financials = {
        waterBase,
        waterPaid,
        waterWaived,
        assocBase,
        assocPaid,
        assocWaived,
        miscPaid
      };

      return mapRowToResident(row, userRow, financials);
    })
    .filter((r) => r.residentId && r.residentId !== "");
}

/**
 * Fetches all users from the ResidentRecords spreadsheet.
 */
export async function fetchUsers(forceRefresh = false): Promise<UserRecord[]> {
  if (auth.authType === "resident") {
    // Laundry API no longer exposes full user list for residents.
    // Individual user mapping is now merged into reservations server-side.
    return [];
  }

  const { uiSettings } = await import("./settings.svelte");
  const { fetchSheetRowsRaw } = await import("./google-sheets");

  if (!uiSettings.residentRecordsId) {
    return [];
  }

  const userRows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "users!A:P", forceRefresh);

  return userRows
    .slice(1)
    .map((row) => ({
      email: (row[USER_COL.EMAIL] || "").trim(),
      lastName: (row[USER_COL.LAST_NAME] || "").trim(),
      firstName: (row[USER_COL.FIRST_NAME] || "").trim(),
      middleName: (row[USER_COL.MIDDLE_NAME] || "").trim(),
      suffix: (row[USER_COL.SUFFIX] || "").trim(),
      overrideName: (row[USER_COL.OVERRIDE_NAME] || "").trim(),
      displayName: (row[USER_COL.DISPLAY_NAME] || "").trim(),
      displayNameFormal: (row[USER_COL.DISPLAY_NAME_FL] || "").trim(),
      studentNo: (row[USER_COL.STUDENT_NO] || "").trim(),
      secondaryContact: (row[USER_COL.SECONDARY_CONTACT] || "").trim(),
      address: (row[USER_COL.ADDRESS] || "").trim(),
      college: (row[USER_COL.COLLEGE] || "").trim(),
      program: (row[USER_COL.DEGREE_PROGRAM] || "").trim(),
      tags: (row[USER_COL.TAGS] || "").trim(),
      notes: (row[USER_COL.NOTES] || "").trim(),
      id: (row[USER_COL.ID] || "").trim(),
      raw: row
    }))
    .filter((u) => u.id !== "");
}

/**
 * Fetches the current active term from constants.
 */
export async function fetchTermCurr(forceRefresh = false): Promise<string> {
  const { uiSettings } = await import("./settings.svelte");
  const { fetchSheetRowsRaw } = await import("./google-sheets");

  if (!uiSettings.accountingWorkbookId) return "";

  const rows = await fetchSheetRowsRaw(
    uiSettings.accountingWorkbookId,
    "constants!A:C",
    forceRefresh
  );
  const found = rows.find((r) => r[0] === "TERM_CURR");
  return found?.[1] || "";
}

/**
 * Fetches a single user by their ID.
 */
export async function fetchUserById(id: string): Promise<UserRecord | null> {
  const users = await fetchUsers();
  return users.find((u) => u.id === id) || null;
}

/**
 * Computes standardized display names based on name parts.
 */
export function computeDisplayNames(data: Partial<UserRecord>) {
  const first = (data.firstName || "").trim().toUpperCase();
  const last = (data.lastName || "").trim().toUpperCase();
  const suffix = (data.suffix || "").trim().toUpperCase();
  const override = (data.overrideName || "").trim();

  if (override) {
    return {
      displayName: override,
      displayNameFormal: override
    };
  }

  // display_name: [LAST NAME, FIRST_NAME SUFFIX]
  const dnParts = [];
  if (last) {
    dnParts.push(`${last},`);
  }
  if (first) {
    dnParts.push(first);
  }
  if (suffix) {
    dnParts.push(suffix);
  }
  const displayName = dnParts.join(" ").replace(/, /, ", ").trim();

  // display_name_fl: [FIRST_NAME LAST_NAME SUFFIX]
  const flParts = [];
  if (first) {
    flParts.push(first);
  }
  if (last) {
    flParts.push(last);
  }
  if (suffix) {
    flParts.push(suffix);
  }
  const displayNameFormal = flParts.join(" ").trim();

  return {
    displayName,
    displayNameFormal
  };
}

/**
 * Updates a user record in the ResidentRecords spreadsheet.
 */
export async function updateUser(userId: string, data: Partial<UserRecord>) {
  const { uiSettings } = await import("./settings.svelte");
  const { fetchSheetRowsRaw, updateSheetValue } = await import("./google-sheets");

  if (!uiSettings.residentRecordsId) throw new Error("Resident Records ID not configured");

  const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "users!A:P");
  const rowIndex = rows.findIndex((r) => (r[USER_COL.ID] || "").trim() === userId);
  if (rowIndex === -1) throw new Error("User not found");

  const actualRow = rowIndex + 1;
  const currentRow = rows[rowIndex];

  // Prepare the new row data
  const newRow = [...currentRow];
  if (data.email !== undefined) newRow[USER_COL.EMAIL] = data.email.trim().toLowerCase();
  if (data.lastName !== undefined) newRow[USER_COL.LAST_NAME] = data.lastName.trim().toUpperCase();
  if (data.firstName !== undefined)
    newRow[USER_COL.FIRST_NAME] = data.firstName.trim().toUpperCase();
  if (data.middleName !== undefined)
    newRow[USER_COL.MIDDLE_NAME] = data.middleName.trim().toUpperCase();
  if (data.suffix !== undefined) newRow[USER_COL.SUFFIX] = data.suffix.trim().toUpperCase();
  if (data.overrideName !== undefined) newRow[USER_COL.OVERRIDE_NAME] = data.overrideName;

  // Recompute display names if parts changed
  const computed = computeDisplayNames({
    firstName: data.firstName ?? currentRow[USER_COL.FIRST_NAME],
    lastName: data.lastName ?? currentRow[USER_COL.LAST_NAME],
    middleName: data.middleName ?? currentRow[USER_COL.MIDDLE_NAME],
    suffix: data.suffix ?? currentRow[USER_COL.SUFFIX],
    overrideName: data.overrideName ?? currentRow[USER_COL.OVERRIDE_NAME]
  });

  newRow[USER_COL.DISPLAY_NAME] = computed.displayName;
  newRow[USER_COL.DISPLAY_NAME_FL] = computed.displayNameFormal;

  if (data.studentNo !== undefined) newRow[USER_COL.STUDENT_NO] = data.studentNo;
  if (data.secondaryContact !== undefined)
    newRow[USER_COL.SECONDARY_CONTACT] = data.secondaryContact;
  if (data.address !== undefined) newRow[USER_COL.ADDRESS] = data.address;
  if (data.college !== undefined) newRow[USER_COL.COLLEGE] = data.college;
  if (data.program !== undefined) newRow[USER_COL.DEGREE_PROGRAM] = data.program;
  if (data.tags !== undefined) newRow[USER_COL.TAGS] = data.tags;
  if (data.notes !== undefined) newRow[USER_COL.NOTES] = data.notes;

  await updateSheetValue(uiSettings.residentRecordsId, `users!A${actualRow}:P${actualRow}`, [
    newRow
  ]);
}

/**
 * Adds a new user record to the ResidentRecords spreadsheet.
 */
export async function addUser(data: Partial<UserRecord>) {
  const { uiSettings } = await import("./settings.svelte");
  const { appendSheetRow } = await import("./google-sheets");

  if (!uiSettings.residentRecordsId) throw new Error("Resident Records ID not configured");

  const row = new Array(16).fill("");
  row[USER_COL.EMAIL] = (data.email || "").trim().toLowerCase();
  row[USER_COL.LAST_NAME] = (data.lastName || "").trim().toUpperCase();
  row[USER_COL.FIRST_NAME] = (data.firstName || "").trim().toUpperCase();
  row[USER_COL.MIDDLE_NAME] = (data.middleName || "").trim().toUpperCase();
  row[USER_COL.SUFFIX] = (data.suffix || "").trim().toUpperCase();
  row[USER_COL.OVERRIDE_NAME] = (data.overrideName || "").trim();

  const computed = computeDisplayNames(data);
  row[USER_COL.DISPLAY_NAME] = computed.displayName;
  row[USER_COL.DISPLAY_NAME_FL] = computed.displayNameFormal;

  row[USER_COL.STUDENT_NO] = data.studentNo || "";
  row[USER_COL.SECONDARY_CONTACT] = data.secondaryContact || "";
  row[USER_COL.ADDRESS] = data.address || "";
  row[USER_COL.COLLEGE] = data.college || "";
  row[USER_COL.DEGREE_PROGRAM] = data.program || "";
  row[USER_COL.TAGS] = data.tags || "";
  row[USER_COL.NOTES] = data.notes || "";
  row[USER_COL.ID] = data.id || crypto.randomUUID();

  await appendSheetRow(uiSettings.residentRecordsId, "users!A:P", [row]);
}

/**
 * Adds multiple user records in a single operation.
 */
export async function addUsersBatch(users: Partial<UserRecord>[]) {
  const { uiSettings } = await import("./settings.svelte");
  const { appendSheetRow } = await import("./google-sheets");

  if (!uiSettings.residentRecordsId) throw new Error("Resident Records ID not configured");

  const rows = users.map((data) => {
    const row = new Array(16).fill("");
    row[USER_COL.EMAIL] = data.email || "";
    row[USER_COL.LAST_NAME] = data.lastName || "";
    row[USER_COL.FIRST_NAME] = data.firstName || "";
    row[USER_COL.MIDDLE_NAME] = data.middleName || "";
    row[USER_COL.SUFFIX] = data.suffix || "";
    row[USER_COL.OVERRIDE_NAME] = data.overrideName || "";

    const computed = computeDisplayNames(data);
    row[USER_COL.DISPLAY_NAME] = computed.displayName;
    row[USER_COL.DISPLAY_NAME_FL] = computed.displayNameFormal;

    row[USER_COL.STUDENT_NO] = data.studentNo || "";
    row[USER_COL.SECONDARY_CONTACT] = data.secondaryContact || "";
    row[USER_COL.ADDRESS] = data.address || "";
    row[USER_COL.COLLEGE] = data.college || "";
    row[USER_COL.DEGREE_PROGRAM] = data.program || "";
    row[USER_COL.TAGS] = data.tags || "";
    row[USER_COL.NOTES] = data.notes || "";
    row[USER_COL.ID] = data.id || crypto.randomUUID();
    return row;
  });

  await appendSheetRow(uiSettings.residentRecordsId, "users!A:P", rows);
}

/**
 * Fetches all account records for a specific user ID.
 */
export async function fetchAccountsByUserId(userId: string): Promise<ResidentRecord[]> {
  const allResidents = await fetchResidents();
  return allResidents.filter((r) => r.residentId === userId);
}

/**
 * Deletes a user record only if they have no linked accounts.
 */
export async function deleteUser(userId: string) {
  const { uiSettings } = await import("./settings.svelte");
  const { fetchSheetRowsRaw, deleteSheetRow } = await import("./google-sheets");

  if (!uiSettings.residentRecordsId) throw new Error("Resident Records ID not configured");

  // 1. Safety Check: Check for linked accounts
  const accounts = await fetchAccountsByUserId(userId);
  if (accounts.length > 0) {
    throw new Error(`Cannot delete user: ${accounts.length} linked account(s) found.`);
  }

  // 2. Find row index in users sheet
  const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "users!A:P");
  const rowIndex = rows.findIndex((r) => (r[USER_COL.ID] || "").trim() === userId);
  if (rowIndex === -1) throw new Error("User not found in spreadsheet");

  // 3. Delete row
  await deleteSheetRow(uiSettings.residentRecordsId, "users", rowIndex);
}

/**
 * Maps a raw Journal sheet row to a typed JournalRecord.
 */
export function mapRowToJournal(row: string[], index?: number): JournalRecord {
  const water = parseAmount(row[JOURNAL_COL.WATER]);
  const assoc = parseAmount(row[JOURNAL_COL.ASSOC]);
  const misc = parseAmount(row[JOURNAL_COL.MISC]);

  return {
    raw: row,
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
    wasAudited: (row[JOURNAL_COL.WAS_AUDITED] || "").toString().toUpperCase() === "TRUE",
    receiptUrl: (row[JOURNAL_COL.RECEIPT_URL] || "").trim(),
    id: (row[JOURNAL_COL.ID] || "").trim(),
    ledgerIndex: index
  };
}

/**
 * Stages a single status reminder email in the dispatcher.
 */
export function stageStatusEmail(
  resident: ResidentRecord,
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    customReminders?: string;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "REMINDER";

  if (options.customReminders) {
    emailDispatcher.customReminders = options.customReminders;
  } else if (branding.defaultReminders) {
    emailDispatcher.customReminders = branding.defaultReminders;
  }

  emailDispatcher.push(
    mapResidentToStagedEmail(resident, branding, emailDispatcher.customReminders)
  );

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages multiple status reminder emails.
 */
export function stageStatusEmailBatch(
  residents: ResidentRecord[],
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    customReminders?: string;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "REMINDER";

  if (options.customReminders) {
    emailDispatcher.customReminders = options.customReminders;
  } else if (branding.defaultReminders) {
    emailDispatcher.customReminders = branding.defaultReminders;
  }

  for (const r of residents) {
    emailDispatcher.push(mapResidentToStagedEmail(r, branding, emailDispatcher.customReminders));
  }

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages a single clearance certificate email.
 */
export function stageClearanceEmail(
  resident: ResidentRecord,
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "CLEARANCE";

  emailDispatcher.push(mapResidentToStagedClearance(resident, branding));

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages multiple clearance certificate emails.
 */
export function stageClearanceEmailBatch(
  residents: ResidentRecord[],
  branding: BrandingProfile,
  options: {
    clearQueue?: boolean;
    redirect?: boolean;
  } = {}
) {
  if (options.clearQueue) {
    emailDispatcher.clear();
  }

  emailDispatcher.configType = "reminders";
  emailDispatcher.batchType = "CLEARANCE";

  for (const r of residents) {
    if (r.ceLink) {
      emailDispatcher.push(mapResidentToStagedClearance(r, branding));
    }
  }

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Private mapper from record to staged email.
 */
function mapResidentToStagedEmail(
  resident: ResidentRecord,
  branding: BrandingProfile,
  customReminders?: string
) {
  return {
    id: resident.stno,
    to: resident.email,
    recipientName: resident.name,
    template: PaymentStatusTemplate as any,
    data: {
      accountName: resident.name,
      room: resident.room,
      bed: resident.bed,
      waterBase: resident.waterBase,
      waterPaid: resident.waterPaid,
      waterWaived: resident.waterWaived,
      waterBal: resident.waterBal,
      assocBase: resident.assocBase,
      assocPaid: resident.assocPaid,
      assocWaived: resident.assocWaived,
      assocBal: resident.assocBal,
      totalBase: resident.totalBase,
      paid: resident.paid,
      waived: resident.waived,
      bal: resident.bal,
      isFullyPaid: resident.isFullyPaid,
      reminders: customReminders || "",
      warnReservationCancellation: false,
      warnClearance: false,
      hideBedNotice: false,
      headerImageUrl: branding.emailHeaderUrl,
      replyTo: branding.replyTo
    },
    branding: branding
  };
}

/**
 * Private mapper from record to staged clearance email.
 */
function mapResidentToStagedClearance(resident: ResidentRecord, branding: BrandingProfile) {
  return {
    id: resident.stno,
    to: resident.email,
    recipientName: resident.name,
    template: ClearanceCertificateTemplate as any,
    data: {
      accountName: resident.name,
      ceFullName: resident.ceFullName,
      period: resident.period,
      ceLink: resident.ceLink,
      ceRefNo: resident.ceRefNo
    },
    branding: branding
  };
}

/**
 * Clears a resident by generating a clearance link and updating the spreadsheet.
 */
export async function clearResident(
  resident: ResidentRecord,
  spreadsheetId: string,
  brandingKey: string,
  issuerId: string
) {
  const { updateSheetValue, fetchSheetRowsRaw } = await import("./google-sheets");

  const now = new Date();
  const dateString = now.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  const refNo = crypto.randomUUID();

  const clearanceData = {
    name: resident.ceFullName,
    stno: resident.stno,
    period: resident.period,
    dateIssued: dateString,
    refNo: refNo,
    branding: brandingKey,
    issuerId
  };

  const publicLink = `${window.location.origin}/clearance/${refNo}`;

  const rows = await fetchSheetRowsRaw(spreadsheetId, "accounts!A:C");
  const rowIndex = rows.findIndex(
    (r) =>
      r[ACCOUNT_COL.RESIDENT_ID]?.trim() === resident.residentId &&
      r[ACCOUNT_COL.PERIOD]?.trim() === resident.period
  );

  if (rowIndex === -1) throw new Error("Resident not found in sheet");

  const actualRow = rowIndex + 1;

  await Promise.all([
    updateSheetValue(spreadsheetId, `accounts!F${actualRow}`, [[refNo]]),
    updateSheetValue(spreadsheetId, `accounts!G${actualRow}`, [[dateString]]),
    updateSheetValue(spreadsheetId, `accounts!H${actualRow}`, [[publicLink]]),
    updateSheetValue(spreadsheetId, `accounts!J${actualRow}`, [[issuerId]])
  ]);

  return { refNo, dateString, publicLink };
}

/**
 * Returns a standardized status string for a resident record based on payment progress.
 */
export function getPaymentStatus(r: ResidentRecord): string {
  if (r.ceIssued && r.ceIssued !== "" && r.ceIssued !== "#N/A" && r.ceIssued !== "N/A") {
    return "CLEARED";
  }
  if (r.bal < 0) {
    return "OVERPAID";
  }
  if (r.totalBase > 0 && r.bal <= 0) {
    return "FULLY_PAID";
  }
  if (r.totalBase === 0) {
    return "NO_RECORD";
  }

  const progress = (r.paid + r.waived) / r.totalBase;
  if (progress >= 0.5) {
    return "HALF_FULLY_PAID";
  }
  if (progress > 0) {
    return "PARTIALLY_PAID";
  }
  return "NO_PAYMENT";
}

/**
 * Standardized logic for matching a resident record against payment status filters.
 */
export function matchesStatusFilter(r: ResidentRecord, filter: string): boolean {
  if (filter === "ALL") return true;

  const status = getPaymentStatus(r);

  switch (filter) {
    case "FULLY_PAID":
      return status === "FULLY_PAID" || status === "CLEARED" || status === "OVERPAID";
    case "HALF_FULLY_PAID":
      return status === "HALF_FULLY_PAID";
    case "PARTIALLY_PAID":
      return status === "PARTIALLY_PAID";
    case "NO_PAYMENT":
      return status === "NO_PAYMENT";
    case "CLEARED":
      return status === "CLEARED";
    case "PENDING":
      return status !== "CLEARED" && status !== "FULLY_PAID" && status !== "OVERPAID";
    default:
      return true;
  }
}
