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
  NOTES: 8,
  ISSUER_ID: 9,
  CHECK_IN_DATE: 10
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
  ADDRESS: 10,
  COLLEGE: 11,
  DEGREE_PROGRAM: 12,
  TAGS: 13,
  NOTES: 14,
  ID: 15
} as const;

export const CURR_COL = {
  TIMESTAMP: 0,
  EMAIL: 1,
  ROOM: 2,
  BED: 3,
  PROGRAM: 4,
  STUDENT_NO: 5,
  CHECK_IN_DATE: 6,
  LAST_NAME: 7,
  FIRST_NAME: 8,
  COLLEGE: 9,
  EVALUATED: 10
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
  checkInDate: string;
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

export interface UserRecord {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  overrideName: string;
  displayName: string;
  displayNameFormal: string;
  studentNo: string;
  secondaryContact: string;
  address: string;
  college: string;
  program: string;
  tags: string;
  notes: string;
  id: string;
  raw: string[];
}
export enum UserTag {
  STUDENT = "STUDENT",
  ALUMNUS = "ALUMNUS",
  FACULTY = "FACULTY",
  INTERNAL = "INTERNAL",
  DECEASED = "DECEASED",
  BACKED_OUT = "BACKED-OUT",
  RETURNING = "RETURNING",
  HRDO = "HRDO",
  GUEST = "GUEST"
}

export const USER_TAG_COLORS: Record<string, string> = {
  [UserTag.STUDENT]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [UserTag.ALUMNUS]: "bg-blue-100 text-blue-700 border-blue-200",
  [UserTag.FACULTY]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.INTERNAL]: "bg-amber-100 text-amber-700 border-amber-200",
  [UserTag.DECEASED]: "bg-red-100 text-red-700 border-red-200",
  [UserTag.BACKED_OUT]: "bg-red-100 text-red-700 border-red-200",
  [UserTag.RETURNING]: "bg-cyan-100 text-cyan-700 border-cyan-200",
  [UserTag.HRDO]: "bg-indigo-100 text-indigo-700 border-indigo-200",
  [UserTag.GUEST]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};
