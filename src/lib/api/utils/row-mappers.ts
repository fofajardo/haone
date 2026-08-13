import {
  USER_COL,
  ACCOUNT_COL,
  JOURNAL_COL,
  type ResidentRecord,
  type JournalRecord,
  type UserRecord
} from "$lib/types";
import { parseCSVAmount } from "$utils/math";

export function computeDisplayNames(data: Partial<UserRecord>) {
  const first = (data.firstName || "").trim().toUpperCase();
  const last = (data.lastName || "").trim().toUpperCase();
  const suffix = (data.suffix || "").trim().toUpperCase();

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
    id: (row[ACCOUNT_COL.ID] || "").trim(),
    ledgerId: (row[ACCOUNT_COL.ID] || "").trim(),
    checkInDate: (row[ACCOUNT_COL.CHECK_IN_DATE] || "").trim(),
    type: (row[ACCOUNT_COL.TYPE] || "").trim()
  };
}

export function mapRowToJournal(row: string[], index?: number): JournalRecord {
  const water = parseCSVAmount(row[JOURNAL_COL.WATER]);
  const assoc = parseCSVAmount(row[JOURNAL_COL.ASSOC]);
  const misc = parseCSVAmount(row[JOURNAL_COL.MISC]);

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
    wasAudited: (row[JOURNAL_COL.WAS_AUDITED] || "").toUpperCase() === "TRUE",
    receiptUrl: (row[JOURNAL_COL.RECEIPT_URL] || "").trim(),
    id: (row[JOURNAL_COL.ID] || "").trim(),
    ledgerIndex: index
  };
}
