import { json } from "@sveltejs/kit";
import {
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  USER_COL,
  USER_SETTINGS_COL,
  AccountType,
  CURR_COL,
  ACCOUNT_COL
} from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  serverError,
  fetchSheetsData,
  resolveResidentAccountType
} from "$lib/server/api-helper";
import { canAccessAchievements } from "$lib/logic/resident-logic";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();

    // 1. Fetch All Data
    const [achRows, logRows, settingRows, userRows, accRows, activeTerm, currRows] =
      await fetchSheetsData(client, [
        "achievements!A:H",
        "achievement_records!A:F",
        "settings!A:B",
        "users!A:P",
        "accounts!A:L",
        "TERM_CURR",
        "CURR!A:O"
      ]);

    // Check if requester is an admin
    let isAdmin = false;
    try {
      const { authenticateAdmin } = await import("$lib/server/api-helper");
      const adminAuth = await authenticateAdmin(request);
      if (!adminAuth.error) {
        isAdmin = true;
      }
    } catch (e) {
      // Ignore
    }

    // 2. Resolve Current Resident
    const currentResidentId = residentId;
    if (!currentResidentId && !isAdmin) {
      return json({ achievements: [], logs: [], currentResidentId: "" });
    }

    const userRow = userRows.find((r: any) => (r[USER_COL.ID] || "").trim() === currentResidentId);
    const email = (userRow?.[USER_COL.EMAIL] || "").trim().toLowerCase();

    const currEntry = currRows
      .slice()
      .reverse()
      .find(
        (r: any) =>
          (r[CURR_COL.EMAIL] || "").trim().toLowerCase() === email &&
          (r[CURR_COL.TERM] || "") === activeTerm
      );

    const isAlum = currEntry?.[CURR_COL.ACCOUNT_TYPE] === AccountType.ALUMNUS;

    let accountType = isAlum
      ? AccountType.ALUMNUS
      : resolveResidentAccountType(accRows, activeTerm, currentResidentId);

    // Bypass check if admin
    if (!accountType && !isAdmin) {
      return json(
        { error: "Access Denied: Resident does not have an account for the current term" },
        { status: 403 }
      );
    }

    if (accountType && !canAccessAchievements(accountType) && !isAdmin) {
      return json(
        { error: "Access Denied: Account type cannot access achievements" },
        { status: 403 }
      );
    }

    // Calculate eligible counts
    const accountsCountMap = new Map();
    accRows.slice(1).forEach((r: any) => {
      const term = (r[ACCOUNT_COL.PERIOD] || "").trim();
      if (term) {
        accountsCountMap.set(term, (accountsCountMap.get(term) || 0) + 1);
      }
    });
    const totalUsersCount = userRows.slice(1).length;

    // 3. Map Achievements
    const achievements = achRows.slice(1).map((row: any) => {
      const term = (row[ACHIEVEMENT_COL.TERM] || "").trim();
      const eligibleCount = term ? accountsCountMap.get(term) || 0 : totalUsersCount;
      return {
        id: (row[ACHIEVEMENT_COL.ID] || "").trim(),
        creatorId: (row[ACHIEVEMENT_COL.CREATOR_ID] || "").trim(),
        name: (row[ACHIEVEMENT_COL.NAME] || "").trim(),
        description: (row[ACHIEVEMENT_COL.DESCRIPTION] || "").trim(),
        icon: (row[ACHIEVEMENT_COL.ICON] || "").trim(),
        extraUrl: (row[ACHIEVEMENT_COL.EXTRA_URL] || "").trim(),
        term: term,
        points: Number(row[ACHIEVEMENT_COL.POINTS] || 0),
        totalEligibleCount: eligibleCount
      };
    });

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
        term: (row[ACHIEVEMENT_RECORD_COL.TERM] || "").trim(),
        // Only provide name if public or it's the current user
        displayName: isPublic ? userMap.get(accountId) || "Resident" : "Private Resident",
        isPublic
      };
    });

    let displayedAchievements = achievements;
    if (accountType === AccountType.ALUMNUS && !isAdmin) {
      const currentResidentEarnedIds = new Set(
        logs
          .filter((log: any) => log.accountId === currentResidentId)
          .map((log: any) => log.achievementId)
      );
      displayedAchievements = achievements.filter((achievement: any) =>
        currentResidentEarnedIds.has(achievement.id)
      );
    }

    return json({ achievements: displayedAchievements, logs, currentResidentId, isAdmin });
  } catch (e: any) {
    return serverError(e, "Achievements fetch");
  }
};
