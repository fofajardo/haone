/**
 * Definitive Column Indices for HAOne Google Sheets.
 */

export const JOURNAL_COL = {
  DATE: 0,
  CREATOR: 1, // EMAIL
  ACCOUNT: 2, // EMAIL
  WATER: 3,
  ASSOC: 4,
  MISC: 5,
  MOP: 6,
  PERIOD: 7,
  TYPE: 8,
  NOTES: 9,
  NOTES_PRIVATE: 10,
  MOP_REFNO: 11,
  PR_DATE_ISSUED: 12,
  PR_REFNO: 13,
  CREATOR_NAME: 14,
  NAME: 15, // ACCOUNT_NAME
  STNO: 16, // ST_NO
  WAS_AUDITED: 17,
  RECEIPT_URL: 18,
  ID: 19
} as const;

export const ACCOUNT_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  PERIOD: 2,
  ROOM: 3,
  BED: 4,
  CE_REFNO: 5,
  CE_ISSUED: 6,
  CE_LINK: 7,
  NOTES: 8
} as const;

export const USER_COL = {
  EMAIL: 0,
  LAST_NAME: 1,
  FIRST_NAME: 2,
  MIDDLE_NAME: 3,
  SUFFIX: 4,
  OVERRIDE_NAME: 5,
  DISPLAY_NAME: 6,
  DISPLAY_NAME_FL: 7,
  STUDENT_NO: 8,
  SECONDARY_CONTACT: 9,
  COLLEGE: 10,
  DEGREE_PROGRAM: 11,
  TYPE: 12,
  NOTES: 13,
  ID: 14
} as const;

export interface ResidentRecord {
  email: string;
  period: string;
  room: string;
  bed: string;
  name: string;
  stno: string;
  waterBase: number;
  waterPaid: number;
  waterWaived: number;
  waterBal: number;
  assocBase: number;
  assocPaid: number;
  assocWaived: number;
  assocBal: number;
  totalBase: number;
  paid: number;
  waived: number;
  bal: number;
  isFullyPaid: boolean;
  notes: string;
  college: string;
  program: string;
  ceIssued: string;
  ceRefNo: string;
  ceLink: string;
  ceFullName: string;
  residentId: string;
  ledgerId: string;
  raw: string[];
}

export interface JournalRecord {
  date: string;
  creator: string; // EMAIL
  account: string; // EMAIL
  water: number;
  assoc: number;
  misc: number;
  amount: number;
  mop: string;
  period: string;
  type: string;
  notes: string;
  notesPrivate: string;
  mopRefNo: string;
  prDateIssued: string;
  prRefNo: string;
  creatorName: string;
  name: string; // ACCOUNT_NAME
  stno: string;
  wasAudited: boolean;
  receiptUrl: string;
  id: string;
  raw: string[];
  dateWeight?: number;
  ledgerIndex?: number;
  runningBalance?: number;
  incoming?: number;
  outgoing?: number;
}
