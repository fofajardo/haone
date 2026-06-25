import { json } from "@sveltejs/kit";
import {
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  USER_COL,
  USER_SETTINGS_COL,
  ACCOUNT_COL
} from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  serverError,
  fetchSheetsData,
  resolveResidentAccountType
} from "$lib/server/api-helper";
import { canAccessAchievements } from "$lib/resident-logic";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();

    // 1. Fetch All Data
    const [achRows, logRows, settingRows, userRows, accRows, activeTerm] = await fetchSheetsData(
      client,
      [
        "achievements!A:F",
        "achievement_records!A:E",
        "settings!A:B",
        "users!A:P",
        "accounts!A:L",
        "TERM_CURR"
      ]
    );

    // 2. Resolve Current Resident
    const currentResidentId = residentId;
    if (!currentResidentId) return json({ achievements: [], logs: [], currentResidentId: "" });

    const accountType = resolveResidentAccountType(accRows, activeTerm, currentResidentId);

    if (!canAccessAchievements(accountType)) {
      return json(
        { error: "Access Denied: Account type cannot access achievements" },
        { status: 403 }
      );
    }

    // 3. Map Achievements
    const achievements = achRows.slice(1).map((row: any) => ({
      id: (row[ACHIEVEMENT_COL.ID] || "").trim(),
      creatorId: (row[ACHIEVEMENT_COL.CREATOR_ID] || "").trim(),
      name: (row[ACHIEVEMENT_COL.NAME] || "").trim(),
      description: (row[ACHIEVEMENT_COL.DESCRIPTION] || "").trim(),
      icon: (row[ACHIEVEMENT_COL.ICON] || "").trim(),
      extraUrl: (row[ACHIEVEMENT_COL.EXTRA_URL] || "").trim()
    }));

    // 4. Map Settings & Users for Privacy
    const settingsMap = new Map();
    settingRows.slice(1).forEach((r: any) => {
      settingsMap.set(
        (r[USER_SETTINGS_COL.RESIDENT_ID] || "").trim(),
        (r[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "").toUpperCase() === "TRUE"
      );
    });

    const userMap = new Map();
    userRows.slice(1).forEach((r: any) => {
      userMap.set((r[USER_COL.ID] || "").trim(), (r[USER_COL.DISPLAY_NAME] || "").trim());
    });

    // 5. Map Logs with Privacy
    const logs = logRows.slice(1).map((row: any) => {
      const accountId = (row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] || "").trim();
      const isPublic = settingsMap.get(accountId) || accountId === currentResidentId;

      return {
        id: (row[ACHIEVEMENT_RECORD_COL.ID] || "").trim(),
        accountId: accountId,
        achievementId: (row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] || "").trim(),
        date: (row[ACHIEVEMENT_RECORD_COL.DATE] || "").trim(),
        // Only provide name if public or it's the current user
        displayName: isPublic ? userMap.get(accountId) || "Resident" : "Private Resident",
        isPublic
      };
    });

    return json({ achievements, logs, currentResidentId });
  } catch (e: any) {
    return serverError(e, "Achievements fetch");
  }
};
