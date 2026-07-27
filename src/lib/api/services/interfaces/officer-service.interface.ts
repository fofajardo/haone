import type { OfficerRecord } from "$lib/types";

export interface OfficerServiceInterface {
  fetchOfficers(): Promise<OfficerRecord[]>;

  addOfficer(data: Partial<OfficerRecord>): Promise<void>;

  updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void>;

  deleteOfficer(id: string): Promise<void>;
}
