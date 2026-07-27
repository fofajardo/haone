import { emailDispatcher } from "$state/dispatcher.svelte";
import { PaymentStatusTemplate, StatementOfAccountTemplate } from "$templates/payment-status";
import { ClearanceCertificateTemplate } from "$templates/clearance";
import type { BrandingProfile } from "$lib/types";
import { goto } from "$app/navigation";
import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";
import {
  ACCOUNT_COL,
  JOURNAL_COL,
  USER_COL,
  type ResidentRecord,
  type JournalRecord,
  type UserRecord,
  AccountType
} from "$lib/types";

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

import { residentService } from "$api/services/resident-service";
import { constantsService } from "$api/services/constants-service";

/**
 * Resolves the primary identifier of the currently signed-in resident.
 * In Supabase mode, returns the resident's UUID.
 * In GSheets mode, returns the resident's Email.
 */
export async function getCurrentResidentId(): Promise<string> {
  const { auth } = await import("$state/auth.svelte");
  const { residentState } = await import("$state/resident-state.svelte");
  const { isSupabase } = await import("$api/services/common");

  if (isSupabase) {
    return residentState.status?.profile?.id || "";
  }
  return auth.user?.email || "";
}

/**
 * Fetches resident status (dashboard context) via direct DB in Supabase mode or API route in Sheets mode.
 */
export async function fetchResidentStatus(term?: string, forceRefresh = false): Promise<any> {
  const { auth } = await import("$state/auth.svelte");
  const userEmail = auth.user?.email || "";
  if (!userEmail) return null;
  return residentService.fetchResidentStatus(userEmail, term, forceRefresh);
}

/**
 * Fetches joined resident data from Accounts and ResidentRecords spreadsheets/database.
 */
export async function fetchResidents(
  forceRefresh = false,
  term?: string
): Promise<ResidentRecord[]> {
  return residentService.fetchResidents(forceRefresh, term);
}

export async function fetchUsers(forceRefresh = false): Promise<UserRecord[]> {
  return residentService.fetchUsers(forceRefresh);
}

/**
 * Fetches the current active term from constants.
 */
export async function fetchTermCurr(forceRefresh = false): Promise<string> {
  const val = await constantsService.fetchConstantByKey("TERM_CURR");
  return val || "";
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
  return residentService.updateUser(userId, data);
}

export async function addUser(data: Partial<UserRecord>) {
  return residentService.addUser(data);
}

export async function addUsersBatch(users: Partial<UserRecord>[]) {
  return residentService.addUsersBatch(users);
}

export async function fetchAccountsByUserId(userId: string): Promise<ResidentRecord[]> {
  const allResidents = await fetchResidents();
  return allResidents.filter((r) => r.residentId === userId);
}

export async function deleteUser(userId: string) {
  const accounts = await fetchAccountsByUserId(userId);
  if (accounts.length > 0) {
    throw new Error(`Cannot delete user: ${accounts.length} linked account(s) found.`);
  }
  return residentService.deleteUser(userId);
}

export async function registerResident(data: Record<string, any>): Promise<void> {
  return residentService.registerResident(data);
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
    mapResidentToStagedEmail(resident, branding, "REMINDER", emailDispatcher.customReminders)
  );

  if (options.redirect) {
    goto("/admin/email-dispatcher");
  }
}

/**
 * Stages multiple statement of account emails.
 */
export function stageSoaEmailBatch(
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
  emailDispatcher.batchType = "SOA";

  if (options.customReminders) {
    emailDispatcher.customReminders = options.customReminders;
  } else if (branding.defaultReminders) {
    emailDispatcher.customReminders = branding.defaultReminders;
  }

  for (const r of residents) {
    emailDispatcher.push(
      mapResidentToStagedEmail(r, branding, "SOA", emailDispatcher.customReminders)
    );
  }

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
    emailDispatcher.push(
      mapResidentToStagedEmail(r, branding, "REMINDER", emailDispatcher.customReminders)
    );
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
  template: "SOA" | "REMINDER",
  customReminders?: string
) {
  return {
    id: resident.stno,
    to: resident.email,
    recipientName: resident.name,
    template: template === "SOA" ? StatementOfAccountTemplate : (PaymentStatusTemplate as any),
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

  await residentService.updateClearance(resident.residentId, resident.period, {
    refNo,
    dateString,
    publicLink,
    issuerId
  });

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
  if (filter === "ALL" || !r) {
    return true;
  }

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

export function canAccessLaundry(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (
    type === AccountType.STUDENT ||
    type === AccountType.BOOTCAMP ||
    type === AccountType.TRANSIENT
  ) {
    return true;
  }
  return false;
}

export function canSeeLaundryNames(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (type !== AccountType.TRANSIENT) {
    return true;
  }
  return false;
}

export function canAccessAchievements(accountType: string): boolean {
  const type = (accountType || "").trim().toUpperCase();
  if (
    type === AccountType.STUDENT ||
    type === AccountType.BOOTCAMP ||
    type === AccountType.ALUMNUS
  ) {
    return true;
  }
  return false;
}

export async function changeAccountType(
  residentId: string,
  period: string,
  newType: string
): Promise<void> {
  return residentService.changeAccountType(residentId, period, newType);
}
