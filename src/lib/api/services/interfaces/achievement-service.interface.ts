import type {
  AchievementRecord,
  AchievementLogRecord,
  PaginationOptions,
  PaginatedResponse
} from "$lib/types";

export interface AchievementServiceInterface {
  fetchAchievements(
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<AchievementRecord[] | PaginatedResponse<AchievementRecord>>;

  fetchAchievementLogs(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord>>;

  addAchievement(data: Partial<AchievementRecord>): Promise<void>;

  updateAchievement(id: string, data: Partial<AchievementRecord>): Promise<void>;

  deleteAchievement(id: string): Promise<void>;

  awardAchievement(data: Partial<AchievementLogRecord>): Promise<void>;

  revokeAchievement(logId: string): Promise<void>;

  awardAchievementBatch(records: Partial<AchievementLogRecord>[]): Promise<void>;
}
