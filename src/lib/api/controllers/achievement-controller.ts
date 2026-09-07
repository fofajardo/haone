import { achievementService } from "$api/services/achievement-service";
import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
import { getCurrentResidentId } from "./resident-controller";

export async function fetchAchievements(bypassCache = false): Promise<{
  achievements: AchievementRecord[];
  logs: AchievementLogRecord[];
  currentResidentId: string;
}> {
  const [achRes, logRes, currentResidentId] = await Promise.all([
    achievementService.fetchAchievements(undefined, bypassCache),
    achievementService.fetchAchievementLogs(undefined, undefined, bypassCache),
    getCurrentResidentId()
  ]);
  const achievements = Array.isArray(achRes) ? achRes : achRes.items;
  const logs = Array.isArray(logRes) ? logRes : logRes.items;
  return { achievements, logs, currentResidentId };
}

export function formatAwardDate(dateStr: string): string {
  if (!dateStr) {
    return "—";
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    if (dateStr.includes("T") || dateStr.includes(" ")) {
      return date.toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    }
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

export function calculateAchievementPercentage(
  earnersCount: number,
  totalEligibleCount: number
): number {
  if (totalEligibleCount <= 0) {
    return 0;
  }
  return Math.round((earnersCount / totalEligibleCount) * 100);
}

export function getEligibleCount(
  term: string | undefined,
  residentsCount: number,
  usersCount: number
): number {
  if (term) {
    return residentsCount;
  }
  return usersCount;
}

export async function fetchAdminAchievements(bypassCache = false): Promise<AchievementRecord[]> {
  const res = await achievementService.fetchAchievements(undefined, bypassCache);
  return Array.isArray(res) ? res : res.items;
}

export async function fetchAchievementLogs(bypassCache = false): Promise<AchievementLogRecord[]> {
  const res = await achievementService.fetchAchievementLogs(undefined, undefined, bypassCache);
  return Array.isArray(res) ? res : res.items;
}

export async function addAchievement(data: Omit<AchievementRecord, "raw">) {
  await achievementService.addAchievement(data);
}

export async function updateAchievement(id: string, data: Partial<AchievementRecord>) {
  await achievementService.updateAchievement(id, data);
}

export async function deleteAchievement(id: string) {
  await achievementService.deleteAchievement(id);
}

export async function awardAchievement(data: Omit<AchievementLogRecord, "raw">) {
  const currentLogs = await fetchAchievementLogs();
  const isDuplicate = currentLogs.some(
    (l) => l.accountId === data.accountId && l.achievementId === data.achievementId
  );

  if (isDuplicate) {
    throw new Error("Achievement already granted to this account.");
  }

  await achievementService.awardAchievement(data);
}

export async function revokeAchievement(logId: string) {
  await achievementService.revokeAchievement(logId);
}

export async function awardAchievementBatch(records: Omit<AchievementLogRecord, "raw">[]) {
  if (records.length === 0) {
    return;
  }
  const currentLogs = await fetchAchievementLogs();
  for (const data of records) {
    const isDuplicate = currentLogs.some(
      (l) => l.accountId === data.accountId && l.achievementId === data.achievementId
    );
    if (!isDuplicate) {
      await achievementService.awardAchievement(data);
    }
  }
}
