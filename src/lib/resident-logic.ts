import { emailDispatcher } from "./dispatcher.svelte";
import { PaymentStatusTemplate } from "./templates/payment-status";
import { ClearanceCertificateTemplate } from "./templates/clearance";
import type { BrandingProfile } from "./templates/types";
import { goto } from "$app/navigation";
import { ACCOUNT_COL, JOURNAL_COL, type ResidentRecord, type JournalRecord } from "./schemas";
import { formatCurrency, formatAmount, formatDate } from "./receipt-utils";

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
 * Maps a raw Google Sheets row to a typed ResidentRecord.
 */
export function mapRowToResident(row: string[]): ResidentRecord {
  return {
    raw: row,
    email: (row[ACCOUNT_COL.EMAIL] || "").trim(),
    period: (row[ACCOUNT_COL.PERIOD] || "").trim(),
    room: (row[ACCOUNT_COL.ROOM] || "").trim(),
    bed: (row[ACCOUNT_COL.BED] || "").trim(),
    name: (row[ACCOUNT_COL.NAME] || "").trim(),
    stno: (row[ACCOUNT_COL.STNO] || "").trim(),
    waterBase: parseAmount(row[ACCOUNT_COL.WATER_BASE]),
    waterPaid: parseAmount(row[ACCOUNT_COL.WATER_PAID]),
    waterWaived: parseAmount(row[ACCOUNT_COL.WATER_WAIVED]),
    waterBal: parseAmount(row[ACCOUNT_COL.WATER_BAL]),
    assocBase: parseAmount(row[ACCOUNT_COL.ASSOC_BASE]),
    assocPaid: parseAmount(row[ACCOUNT_COL.ASSOC_PAID]),
    assocWaived: parseAmount(row[ACCOUNT_COL.ASSOC_WAIVED]),
    assocBal: parseAmount(row[ACCOUNT_COL.ASSOC_BAL]),
    totalBase: parseAmount(row[ACCOUNT_COL.BASE]),
    paid: parseAmount(row[ACCOUNT_COL.PAID]),
    waived: parseAmount(row[ACCOUNT_COL.WAIVED]),
    bal: parseAmount(row[ACCOUNT_COL.BAL]),
    isFullyPaid: (row[ACCOUNT_COL.IS_FULLY_PAID] || "").toString().toUpperCase() === "YES",
    ceRefNo: (row[ACCOUNT_COL.CE_REFNO] || "").trim(),
    ceIssued: (row[ACCOUNT_COL.CE_ISSUED] || "").trim(),
    ceLink: (row[ACCOUNT_COL.CE_LINK] || "").trim(),
    ceFullName: (row[ACCOUNT_COL.CE_FULL_NAME] || "").trim(),
    notes: (row[ACCOUNT_COL.NOTES] || "").trim(),
    college: (row[ACCOUNT_COL.COLLEGE] || "").trim(),
    program: (row[ACCOUNT_COL.PROGRAM] || "").trim()
  };
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

  const rows = await fetchSheetRowsRaw(spreadsheetId, "accounts!A:B");
  const rowIndex = rows.findIndex(
    (r) => r[0]?.trim() === resident.email && r[1]?.trim() === resident.period
  );

  if (rowIndex === -1) throw new Error("Resident not found in sheet");

  const actualRow = rowIndex + 1;

  await Promise.all([
    updateSheetValue(spreadsheetId, `accounts!Q${actualRow}`, [[refNo]]),
    updateSheetValue(spreadsheetId, `accounts!R${actualRow}`, [[dateString]]),
    updateSheetValue(spreadsheetId, `accounts!AA${actualRow}`, [[publicLink]])
  ]);

  return { refNo, dateString, publicLink };
}
