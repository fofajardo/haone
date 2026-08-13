export interface CurrRecord {
  timestamp: string;
  email: string;
  room: string;
  bed: string;
  lastName: string;
  firstName: string;
  college: string;
  program: string;
  studentNo: string;
  checkInDate: string;
  isEvaluated: boolean;
  term: string;
  accountType: string;
  suffix?: string;
  overrideName?: string;
  /** 1-indexed position within the provider's fetch order (display/dedup only, NOT a write handle). */
  rowIndex: number;
  raw: any;
}

export interface AccountRow {
  id: string;
  residentId: string;
  period: string;
  room: string;
  bed: string;
  ceRefNo: string;
  ceIssued: string;
  ceLink: string;
  accountNotes: string;
  issuerId: string;
  checkInDate: string;
  type: string;
}

export interface StaticIpRow {
  id: string;
  recorderId: string;
  residentId: string;
  period: string;
  type: string;
  ip: string;
  notes: string;
}

export interface AccountUpdate {
  id: string;
  room?: string;
  bed?: string;
  checkInDate?: string;
}

export interface RoomsServiceInterface {
  fetchCurrRecords(forceRefresh?: boolean): Promise<CurrRecord[]>;
  fetchAccounts(forceRefresh?: boolean): Promise<AccountRow[]>;
  updateAccounts(updates: AccountUpdate[]): Promise<void>;
  appendAccounts(accounts: AccountRow[]): Promise<void>;
  markCurrEvaluated(entries: { email: string; term: string }[]): Promise<void>;
  updateAccountRoomBed(
    residentId: string,
    period: string,
    room: string,
    bed: string
  ): Promise<void>;
  addAccount(account: AccountRow): Promise<void>;
  deleteAccountRow(residentId: string, period: string): Promise<void>;
  /** Writes the BED field (used by the delist flow to annotate e.g. "101 (Early checkout)"). */
  updateAccountBed(residentId: string, period: string, bed: string): Promise<void>;
  fetchStaticIpRows(forceRefresh?: boolean): Promise<StaticIpRow[]>;
  appendStaticIpRows(rows: StaticIpRow[]): Promise<void>;
}
