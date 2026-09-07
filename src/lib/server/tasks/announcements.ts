import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { getSheetsClient, getSheetValues, updateSheetValue } from "$lib/server/api-helper";
import { notifyAllResidents } from "$lib/server/notifications";
import { ANNOUNCEMENT_COL, AnnouncementStatus } from "$lib/types";
import dayjs from "dayjs";

/**
 * Task to check for newly active announcements and notify residents.
 */
export async function runAnnouncementNotifications(ids?: string[]): Promise<number> {
  let totalSent = 0;
  try {
    const client = await getSheetsClient();

    // Fetch all announcements
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "announcements!A:M");
    if (!rows || rows.length <= 1) return 0;

    const now = dayjs();
    console.log(`[Announcement Task] Processing ${rows.length - 1} rows. Filter IDs:`, ids);

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
      const broadcastCount = parseInt(row[ANNOUNCEMENT_COL.BROADCAST_COUNT]) || 0;
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
      const isExplicitlyRequested = ids && ids.includes(id);
      const shouldNotifyAutomatically = !ids && isActive && !isUnlisted;

      if (isExplicitlyRequested || shouldNotifyAutomatically) {
        if (totalSent > 0) {
          // Add a small delay between multiple notifications to avoid browser grouping/coalescing
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const content = row[ANNOUNCEMENT_COL.CONTENT] || "";
        const textContent = content.replace(/<[^>]*>?/gm, "").substring(0, 60) + "…";

        console.log(
          `[Announcement Task] NOTIFYING: "${title}" (ID: ${id}, Explicit: ${!!isExplicitlyRequested})`
        );

        const { sentCount, foundCount } = await notifyAllResidents(
          title,
          textContent,
          `/resident/announcements/${slug}`
        );

        console.log(`[Push] Found: ${foundCount}, Sent: ${sentCount}`);
        totalSent += sentCount;

        // Increment broadcast count in Google Sheets only if at least one notification was sent
        if (sentCount > 0) {
          // Row index in sheet is i + 1
          const range = `announcements!M${i + 1}`;
          await updateSheetValue(client, PUBLIC_GS_SR_ID, range, [
            [(broadcastCount + 1).toString()]
          ]);
        }
      }
    }
    return totalSent;
  } catch (e) {
    console.error("Announcement notifications task failed:", e);
    return totalSent;
  }
}
