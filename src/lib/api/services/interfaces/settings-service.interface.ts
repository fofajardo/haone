import type { UserSettingsRecord } from "$lib/types";

export interface SettingsServiceInterface {
  fetchUserSettings(residentId: string): Promise<UserSettingsRecord | null>;

  updateUserSettings(residentId: string, data: Partial<UserSettingsRecord>): Promise<void>;
}
