import { auth } from "./auth.svelte";
import { fetchServer } from "./utils";
import {
  type UserRecord,
  type ResidentRecord,
  type JournalRecord,
  AccountType
} from "$lib/schemas";

export type ResidentProfile = Pick<
  UserRecord,
  | "id"
  | "email"
  | "firstName"
  | "lastName"
  | "studentNo"
  | "college"
  | "program"
  | "tags"
  | "suffix"
  | "overrideName"
>;

export type ResidentAccount = Omit<
  ResidentRecord,
  "raw" | "ceFullName" | "notes" | "residentId" | "ledgerId" | "checkInDate"
>;

export type Transaction = Pick<
  JournalRecord,
  | "id"
  | "date"
  | "type"
  | "amount"
  | "period"
  | "mop"
  | "notes"
  | "creator"
  | "prRefNo"
  | "runningBalance"
>;

export interface OnboardingAccountEntry {
  room: string;
  bed: string;
  lastName: string;
  firstName: string;
  college: string;
  program: string;
  studentNo: string;
  accountType: string;
  isEvaluated: boolean;
  checkInDate: string;
  suffix: string;
  overrideName: string;
}

export interface OccupiedBed {
  room: string;
  bed: string;
}

export interface ConstantOption {
  value: string;
  label: string;
}

export interface ResidentStatus {
  /** User has previously registered in the system */
  isRegistered: boolean;
  /** User has an active account for the current term */
  hasActiveAccount: boolean;
  /** User has a pending confirmation for their account */
  waitingForConfirmation: boolean;
  /** Front-end selected term (defaults to system active term) */
  activeTerm: string;
  /** System active term */
  systemActiveTerm: string;
  /** An array of all available terms */
  allTerms: string[];
  /** An array of all transaction types */
  transactionTypes: ConstantOption[];
  /** An array of all MOP types */
  mopTypes: ConstantOption[];
  /** Resident's profile information */
  profile: ResidentProfile | null;
  /** Resident's account information */
  account: ResidentAccount | null;
  /** Resident's onboarding information */
  currEntry: OnboardingAccountEntry | null;
  /** An array of all transactions */
  transactions: Transaction[];
  /** An array of all occupied beds */
  occupiedBeds: OccupiedBed[];
}

class ResidentState {
  status = $state<ResidentStatus | null>(null);
  isLoading = $state(false);
  error = $state<string | null>(null);

  async refresh() {
    if (!auth.accessToken) return;
    this.isLoading = true;
    this.error = null;
    try {
      this.status = await fetchServer("/api/resident/check-status", {}, true);
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.isLoading = false;
    }
  }

  forceOnboarding = $state(false);

  get needsOnboarding() {
    if (this.forceOnboarding) return true;
    if (this.status?.currEntry?.accountType === AccountType.ALUMNUS) {
      return !this.status.isRegistered;
    }
    return (
      this.status &&
      (!this.status.isRegistered || !this.status.hasActiveAccount || !this.status.account?.bed)
    );
  }
}

export const residentState = new ResidentState();
