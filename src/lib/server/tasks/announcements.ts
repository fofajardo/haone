import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { ANNOUNCEMENT_COL } from "$lib/schemas";
import {
  getSheetsClient,
  getSheetValues,
  updateSheetValue,
  getFirebaseToken
} from "$lib/server/api-helper";
import { notifyAllResidents } from "$lib/server/notifications";
import dayjs from "dayjs";
import { AnnouncementStatus } from "$lib/schemas";

/**
 * Task to check for newly active announcements and notify residents.
 */
export async function runAnnouncementNotifications(): Promise<number> {
  let totalSent = 0;
  try {
    const client = await getSheetsClient();
    const token = await getFirebaseToken();

    // Fetch all announcements
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "announcements!A:M");
    if (!rows || rows.length <= 1) return 0;

    const now = dayjs();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const id = row[ANNOUNCEMENT_COL.ID];
      const title = row[ANNOUNCEMENT_COL.TITLE];
      const slug = row[ANNOUNCEMENT_COL.SLUG];
      const start = row[ANNOUNCEMENT_COL.START_DATE]
        ? dayjs(row[ANNOUNCEMENT_COL.START_DATE])
        : null;
      const expiry = row[ANNOUNCEMENT_COL.EXPIRY_DATE]
        ? dayjs(row[ANNOUNCEMENT_COL.EXPIRY_DATE])
        : null;
      const isIndefinite = row[ANNOUNCEMENT_COL.IS_INDEFINITE] === "TRUE";
      const wasNotified = row[ANNOUNCEMENT_COL.WAS_NOTIFIED];
      const isUnlisted = row[ANNOUNCEMENT_COL.IS_UNLISTED] === "TRUE";

      let status = AnnouncementStatus.EXPIRED;
      if (start && start.isAfter(now)) {
        status = AnnouncementStatus.FUTURE;
      } else if (isIndefinite) {
        status = AnnouncementStatus.ACTIVE;
      } else if (!expiry || expiry.isAfter(now) || expiry.isSame(now)) {
        status = AnnouncementStatus.ACTIVE;
      }

      const isActive = status === AnnouncementStatus.ACTIVE;
      console.log(id, title, isActive, !isUnlisted, wasNotified !== "TRUE");
      // Notify if active, not unlisted, and not yet notified
      if (isActive && !isUnlisted && wasNotified !== "TRUE") {
        console.log(`[Announcement] Notifying for: ${title}`);

        const { sentCount, foundCount } = await notifyAllResidents(
          "New Announcement",
          title,
          `/resident/announcements/${slug}`
        );

        console.log(`[Push] Found: ${foundCount}, Sent: ${sentCount}`);
        totalSent += sentCount;

        // Mark as notified in Google Sheets only if at least one notification was sent
        if (sentCount > 0) {
          // Row index in sheet is i + 1
          const range = `announcements!M${i + 1}`;
          await updateSheetValue(token, PUBLIC_GS_SR_ID, range, [["TRUE"]]);
        }
      }
    }
    return totalSent;
  } catch (e) {
    console.error("Announcement notifications task failed:", e);
    return totalSent;
  }
}
