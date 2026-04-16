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
  INCOMING: 17,
  OUTGOING: 18,
  BALANCE: 19,
  WAS_AUDITED: 20,
  LEGACY_RECEIPT_URL: 21,
  ID: 22
} as const;

export const ACCOUNT_COL = {
  EMAIL: 0,
  PERIOD: 1,
  ROOM: 2,
  BED: 3,
  WATER_BASE: 4,
  WATER_PAID: 5,
  WATER_WAIVED: 6,
  WATER_BAL: 7,
  ASSOC_BASE: 8,
  ASSOC_PAID: 9,
  ASSOC_WAIVED: 10,
  ASSOC_BAL: 11,
  BASE: 12, // TOTAL_BASE
  PAID: 13,
  WAIVED: 14,
  BAL: 15,
  CE_REFNO: 16,
  CE_ISSUED: 17,
  IS_FULLY_PAID: 18,
  NAME: 19,
  W_CP: 20,
  A_CP: 21,
  W_MONTHLY: 22,
  A_MONTHLY: 23,
  STNO: 24, // CE_STNO
  CE_FULL_NAME: 25,
  CE_LINK: 26,
  NOTES: 27, // ACCOUNT_NOTES
  COLLEGE: 28,
  PROGRAM: 29
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
  legacyReceiptUrl: string;
  id: string;
  raw: string[];
  dateWeight?: number;
  ledgerIndex?: number;
}
