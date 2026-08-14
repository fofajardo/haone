/**
 * Centralized Type & Schema Definitions for HAOne.
 */

/* ==========================================
 * Page & General Types
 * ========================================== */

export interface PageInfo {
  title: string | null;
}

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
  given_name?: string;
}

export interface ReceiptItem {
  name: string;
  amount: number;
}

export interface ReceiptData {
  dateIssued: string;
  paymentDate: string;
  processor: string;
  referenceNumber: string;
  period: string;
  seriesNumber: string;
  receivedFrom: string;
  receivedBy: string;
  notes: string;
  transactionType: string;
  branding: string;
  stno: string;
  items: ReceiptItem[];
}

export interface ClearanceData {
  name: string;
  stno: string;
  period: string;
  dateIssued: string;
  refNo: string;
  branding: string;
  signatory: string;
  signatoryTitle: string;
}

export interface BrandingProfile {
  name: string;
  shortName: string;
  logoUrl: string;
  logoUrlDark: string;
  logoAlt: string;
  letterheadUrl: string;
  issuerName: string;
  emailHeaderUrl: string;
  googleClientId: string;
  replyTo: string;
  spreadsheetId: string;
  sectionRules?: string;
  regFormUrl?: string;
  paymentInstructionsUrl?: string;
  defaultReminders?: string;
}

export interface EmailTemplate<T> {
  subject: (data: T, branding: BrandingProfile) => string;
  generateHtml: (data: T, branding: BrandingProfile) => string;
}

/* ==========================================
 * Google Sheets Definitive Column Indices
 * ========================================== */

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
  CHECK_IN_DATE: 10,
  TYPE: 11
} as const;

export const STATIC_IP_COL = {
  ID: 0,
  RECORDER_ID: 1,
  RESIDENT_ID: 2,
  PERIOD: 3,
  TYPE: 4,
  IP: 5,
  NOTES: 6
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
  EVALUATED: 10,
  TERM: 11,
  ACCOUNT_TYPE: 12,
  SUFFIX: 13,
  OVERRIDE_NAME: 14
} as const;

export const LAUNDRY_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  DATE: 2,
  TIME_START: 3,
  TIME_END: 4,
  STATUS: 5,
  CANCEL_REASON: 6,
  CREATION_TIMESTAMP: 7,
  CANCEL_TIMESTAMP: 8
} as const;

export const PAYMENT_REQUEST_COL = {
  ID: 0,
  RESIDENT_ID: 1,
  DATE: 2,
  WATER_FEE: 3,
  ASSOC_FEE: 4,
  MISC: 5,
  MOP: 6,
  TYPE: 7,
  PROOF_LINK: 8,
  STATUS: 9,
  NOTES: 10,
  STATUS_REASON: 11
} as const;

export const ANNOUNCEMENT_COL = {
  ID: 0,
  CREATOR_ID: 1,
  DATE_CREATED: 2,
  START_DATE: 3,
  EXPIRY_DATE: 4,
  IS_INDEFINITE: 5,
  IS_ADMIN_ONLY: 6,
  TAGS: 7,
  TITLE: 8,
  CONTENT: 9,
  IS_UNLISTED: 10,
  SLUG: 11,
  BROADCAST_COUNT: 12
} as const;

export const ACHIEVEMENT_COL = {
  ID: 0,
  CREATOR_ID: 1,
  NAME: 2,
  DESCRIPTION: 3,
  ICON: 4,
  EXTRA_URL: 5,
  TERM: 6,
  POINTS: 7
} as const;

export const ACHIEVEMENT_RECORD_COL = {
  ID: 0,
  RECORDER_ID: 1,
  ACCOUNT_ID: 2,
  DATE: 3,
  ACHIEVEMENT_ID: 4,
  TERM: 5
} as const;

export const OFFICER_COL = {
  POSITION: 0,
  NAME: 1,
  NICKNAME: 2,
  EMAIL: 3,
  FB_LINK: 4,
  TERM: 5,
  COMMITTEE: 6,
  BIRTHDAY: 7,
  ID: 8,
  STATUS: 9
} as const;

export const USER_SETTINGS_COL = {
  RESIDENT_ID: 0,
  IS_PUBLIC_ACHIEVEMENT_LIST: 1,
  RESIDENT_NAV: 2,
  ADMIN_NAV: 3,
  DENSITY: 4,
  TYPOGRAPHY: 5,
  THEME: 6,
  IS_REDUCED_MOTION: 7,
  CLOCK_FORMAT: 8
} as const;

export const CONSTANT_COL = {
  KEY: 0,
  VALUE: 1,
  DESCRIPTION: 2
} as const;

/* ==========================================
 * Data Record Interfaces
 * ========================================== */

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
  id: string;
  residentId: string;
  ledgerId: string;
  checkInDate: string;
  type: string;
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

export interface LaundryRecord {
  id: string;
  residentId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: LaundryStatus | string;
  cancelReason: string;
  creationTimestamp?: string;
  cancelTimestamp?: string;
  displayName?: string;
  room?: string;
  raw: string[];
}

export interface PaymentRequestRecord {
  id: string;
  residentId: string;
  date: string;
  waterFee: number;
  assocFee: number;
  misc: number;
  mop: string;
  type: string;
  proofLink: string;
  status: string;
  notes: string;
  statusReason?: string;
  raw: string[];
}

export interface AnnouncementRecord {
  id: string;
  creatorId: string;
  dateCreated: string;
  startDate: string;
  expiryDate: string;
  isIndefinite: boolean;
  isAdminOnly: boolean;
  isUnlisted: boolean;
  slug: string;
  creatorName?: string;
  tags: string;
  title: string;
  content: string;
  broadcastCount: number;
  raw: string[];
}

export interface OfficerRecord {
  position: string;
  name: string;
  nickname: string;
  email: string;
  fbLink: string;
  term: string;
  committee: string;
  birthday: string;
  id: string;
  status: OfficerStatus | string;
  raw: string[];
}

export interface AchievementRecord {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  icon: string;
  extraUrl: string;
  term?: string;
  points: number;
  totalEligibleCount?: number;
  raw: string[];
}

export interface AchievementLogRecord {
  id: string;
  recorderId: string;
  accountId: string;
  date: string;
  achievementId: string;
  term?: string;
  displayName?: string;
  isPublic?: boolean;
  raw: string[];
}

export interface UserSettingsRecord {
  residentId: string;
  isPublicAchievementList: boolean;
  residentNav: string;
  adminNav: string;
  density: string;
  typography: string;
  theme: string;
  isReducedMotion: boolean;
  clockFormat: string;
  raw: string[];
}

export interface StaticIpRecord {
  id: string;
  recorderId: string;
  residentId: string;
  period: string;
  type: string;
  ip: string;
  notes: string;
  // Enriched fields (joined)
  name?: string;
  email?: string;
  stno?: string;
  room?: string;
  bed?: string;
  raw: string[];
}

export interface ConstantRecord {
  key: string;
  value: string;
  description: string;
  raw: string[];
}

/* ==========================================
 * Enums & Associated Constants
 * ========================================== */

export enum UserTag {
  STUDENT = "STUDENT",
  BOOTCAMP = "BOOTCAMP",
  ALUMNUS = "ALUMNUS",
  FACULTY = "FACULTY",
  STAFF = "STAFF",
  REPS = "REPS",
  INTERNAL = "INTERNAL",
  DECEASED = "DECEASED",
  BACKED_OUT = "BACKED-OUT",
  RETURNING = "RETURNING",
  GUEST = "GUEST",
  TRANSFERRED_DORM = "TRANSFERRED_DORM",
  TRANSFERRED_OUTSIDE = "TRANSFERRED_OUTSIDE",
  UNKNOWN = "UNKNOWN"
}

export enum AccountType {
  STUDENT = "STUDENT",
  TRANSIENT = "TRANSIENT",
  BOOTCAMP = "BOOTCAMP",
  ALUMNUS = "ALUMNUS",
  FACULTY = "FACULTY",
  STAFF = "STAFF",
  REPS = "REPS"
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.STUDENT]: "Student (UP Mail required)",
  [AccountType.TRANSIENT]: "Transient without classification",
  [AccountType.BOOTCAMP]: "Bootcamp/Associate Degree Candidate",
  [AccountType.ALUMNUS]: "Former Resident/Alum",
  [AccountType.FACULTY]: "UHO Beneficiary: Faculty",
  [AccountType.STAFF]: "UHO Beneficiary: Staff",
  [AccountType.REPS]: "UHO Beneficiary: Research, Extension, and Professional Staff"
};

export const USER_TAG_COLORS: Record<string, string> = {
  [UserTag.STUDENT]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [UserTag.BOOTCAMP]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [UserTag.ALUMNUS]: "bg-blue-100 text-blue-700 border-blue-200",
  [UserTag.FACULTY]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.STAFF]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.REPS]: "bg-purple-100 text-purple-700 border-purple-200",
  [UserTag.INTERNAL]: "bg-amber-100 text-amber-700 border-amber-200",
  [UserTag.DECEASED]: "bg-red-100 text-red-700 border-red-200",
  [UserTag.BACKED_OUT]: "bg-red-100 text-red-700 border-red-200",
  [UserTag.RETURNING]: "bg-cyan-100 text-cyan-700 border-cyan-200",
  [UserTag.GUEST]: "bg-slate-100 text-slate-700 border-slate-200",
  [UserTag.TRANSFERRED_DORM]: "bg-orange-100 text-orange-700 border-orange-200",
  [UserTag.TRANSFERRED_OUTSIDE]: "bg-orange-100 text-orange-700 border-orange-200",
  [UserTag.UNKNOWN]: "bg-stone-100 text-stone-700 border-stone-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum PaymentRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  CANCELLED = "CANCELLED"
}

export const PAYMENT_REQUEST_STATUS_COLORS: Record<string, string> = {
  [PaymentRequestStatus.PENDING]: "bg-amber-100 text-amber-700 border-amber-200",
  [PaymentRequestStatus.APPROVED]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [PaymentRequestStatus.DECLINED]: "bg-rose-100 text-rose-700 border-rose-200",
  [PaymentRequestStatus.CANCELLED]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum OfficerStatus {
  ACTIVE = "ACTIVE",
  RESIGNED = "RESIGNED",
  CHANGED_POSITION = "CHANGED_POSITION"
}

export enum LaundryStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED_BY_ADMIN = "CANCELLED_BY_ADMIN",
  CANCELLED_BY_USER = "CANCELLED_BY_USER"
}

export enum AnnouncementStatus {
  ACTIVE = "ACTIVE",
  FUTURE = "FUTURE",
  EXPIRED = "EXPIRED"
}

export const ANNOUNCEMENT_STATUS_COLORS: Record<string, string> = {
  [AnnouncementStatus.ACTIVE]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [AnnouncementStatus.FUTURE]: "bg-blue-100 text-blue-700 border-blue-200",
  [AnnouncementStatus.EXPIRED]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export enum AnnouncementTag {
  IMPORTANT = "IMPORTANT",
  MAINTENANCE = "MAINTENANCE",
  EVENT = "EVENT",
  BILLING = "BILLING",
  SECURITY = "SECURITY",
  NEWS = "NEWS",
  REGISTRATION = "REGISTRATION",
  CLEANING = "CLEANING"
}

export const ANNOUNCEMENT_TAG_LIST = Object.values(AnnouncementTag);

export const ANNOUNCEMENT_TAG_COLORS: Record<string, string> = {
  [AnnouncementTag.IMPORTANT]: "bg-red-100 text-red-700 border-red-200",
  [AnnouncementTag.MAINTENANCE]: "bg-amber-100 text-amber-700 border-amber-200",
  [AnnouncementTag.EVENT]: "bg-purple-100 text-purple-700 border-purple-200",
  [AnnouncementTag.BILLING]: "bg-blue-100 text-blue-700 border-blue-200",
  [AnnouncementTag.SECURITY]: "bg-rose-100 text-rose-700 border-rose-200",
  [AnnouncementTag.NEWS]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [AnnouncementTag.REGISTRATION]: "bg-cyan-100 text-cyan-700 border-cyan-200",
  [AnnouncementTag.CLEANING]: "bg-slate-100 text-slate-700 border-slate-200",
  DEFAULT: "bg-muted text-muted-foreground border-border"
};

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, any>;
  bypassCache?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
