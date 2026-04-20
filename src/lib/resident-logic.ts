import { emailDispatcher } from "./dispatcher.svelte";
import { PaymentStatusTemplate } from "./templates/payment-status";
import { ClearanceCertificateTemplate } from "./templates/clearance";
import type { BrandingProfile } from "./templates/types";
import { goto } from "$app/navigation";
import {
  ACCOUNT_COL,
  JOURNAL_COL,
  USER_COL,
  type ResidentRecord,
  type JournalRecord
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
    ledgerId: (row[ACCOUNT_COL.ID] || "").trim()
  };
}

/**
 * Fetches joined resident data from Accounts and ResidentRecords spreadsheets.
 */
export async function fetchResidents(forceRefresh = false): Promise<ResidentRecord[]> {
  const { uiSettings } = await import("./settings.svelte");
  const { fetchSheetRowsRaw } = await import("./google-sheets");

  if (!uiSettings.accountingWorkbookId || !uiSettings.residentRecordsId) {
    return [];
  }

  const [accRows, userRows, journalRows, constRows] = await Promise.all([
    fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:I", forceRefresh),
    fetchSheetRowsRaw(uiSettings.residentRecordsId, "users!A:O", forceRefresh),
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
        (j) => j.account.toLowerCase() === email && j.period === period
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
  signatory: string,
  signatoryTitle: string
) {
  const { updateSheetValue, fetchSheetRowsRaw } = await import("./google-sheets");
  const { encryptJSON } = await import("./crypto");

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
    signatory,
    signatoryTitle
  };

  const encrypted = await encryptJSON(clearanceData, resident.stno);
  const publicLink = `${window.location.origin}/clearance?data=${encodeURIComponent(encrypted)}`;

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
    updateSheetValue(spreadsheetId, `accounts!H${actualRow}`, [[publicLink]])
  ]);

  return { refNo, dateString, publicLink };
}

/**
 * Standardized logic for matching a resident record against payment status filters.
 */
export function matchesStatusFilter(r: ResidentRecord, filter: string): boolean {
  if (filter === "ALL") return true;

  const progress = r.totalBase > 0 ? (r.paid + r.waived) / r.totalBase : 0;

  switch (filter) {
    case "FULLY_PAID":
      return r.isFullyPaid || (r.bal <= 0 && r.totalBase > 0);
    case "HALF_FULLY_PAID":
      return !r.isFullyPaid && progress >= 0.5 && (r.paid > 0 || r.waived > 0);
    case "PARTIALLY_PAID":
      return !r.isFullyPaid && progress < 0.5 && (r.paid > 0 || r.waived > 0);
    case "NO_PAYMENT":
      return r.paid <= 0 && r.waived <= 0;
    case "CLEARED":
      return !!r.ceIssued && r.ceIssued !== "" && r.ceIssued !== "#N/A" && r.ceIssued !== "N/A";
    case "PENDING":
      return !r.isFullyPaid;
    default:
      return true;
  }
}
