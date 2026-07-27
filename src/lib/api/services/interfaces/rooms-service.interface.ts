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
  rowIndex: number;
  raw: string[];
}

export interface RoomsServiceInterface {
  fetchCurrRecords(forceRefresh?: boolean): Promise<CurrRecord[]>;
  fetchAccountsRaw(forceRefresh?: boolean): Promise<any[]>;
  batchUpdateAccounts(updates: { range: string; values: any[][] }[]): Promise<void>;
  appendAccounts(rows: any[][]): Promise<void>;
  batchUpdateCurr(updates: { range: string; values: any[][] }[]): Promise<void>;
  updateAccountRoomBed(
    residentId: string,
    period: string,
    room: string,
    bed: string
  ): Promise<void>;
  addAccountRow(row: any[]): Promise<void>;
  deleteAccountRow(residentId: string, period: string): Promise<void>;
  updateAccountCheckInDate(residentId: string, period: string, date: string): Promise<void>;
  fetchStaticIpRows(): Promise<any[]>;
  appendStaticIpRows(rows: any[][]): Promise<void>;
}
