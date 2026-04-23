import { PUBLIC_GS_RR_ID } from "$env/static/public";
import { ANNOUNCEMENT_COL } from "$lib/schemas";
import {
  getSheetsClient,
  getSheetValues,
  updateSheetValue,
  getFirebaseToken
} from "$lib/server/api-helper";
import { notifyAllResidents } from "$lib/server/notifications";

/**
 * Task to check for newly active announcements and notify residents.
 */
export async function runAnnouncementNotifications() {
  try {
    const client = await getSheetsClient();
    const token = await getFirebaseToken();

    // Fetch all announcements
    const rows = await getSheetValues(client, PUBLIC_GS_RR_ID, "announcements!A:M");
    if (!rows || rows.length <= 1) return;

    const todayStr = new Date().toISOString().split("T")[0];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const id = row[ANNOUNCEMENT_COL.ID];
      const startDate = row[ANNOUNCEMENT_COL.START_DATE];
      const title = row[ANNOUNCEMENT_COL.TITLE];
      const slug = row[ANNOUNCEMENT_COL.SLUG];
      const wasNotified = row[ANNOUNCEMENT_COL.WAS_NOTIFIED];
      const isUnlisted = row[ANNOUNCEMENT_COL.IS_UNLISTED] === "TRUE";

      // Notify if active, not unlisted, and not yet notified
      if (startDate <= todayStr && !isUnlisted && wasNotified !== "TRUE") {
        console.log(`[Announcement] Notifying for: ${title}`);

        await notifyAllResidents("New Announcement", title, `/resident/announcements/${slug}`);

        // Mark as notified in Google Sheets
        // Row index in sheet is i + 1
        const range = `announcements!M${i + 1}`;
        await updateSheetValue(token, PUBLIC_GS_RR_ID, range, [["TRUE"]]);
      }
    }
  } catch (e) {
    console.error("Announcement notifications task failed:", e);
  }
}
