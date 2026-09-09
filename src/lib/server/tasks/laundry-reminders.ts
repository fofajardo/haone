import { getSheetsClient, getSheetValues } from "$api/services/server-sheets-service";
import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { notifyResident } from "$lib/server/notifications";
import { LAUNDRY_COL } from "$lib/types";

/**
 * Task to check for upcoming laundry slots and send reminders.
 */
export async function runLaundryReminders() {
  try {
    const client = await getSheetsClient();
    // Fetch all laundry reservations
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "laundry!A:K");
    if (!rows || rows.length <= 1) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Process rows
    for (const row of rows.slice(1)) {
      const status = row[LAUNDRY_COL.STATUS];
      const date = row[LAUNDRY_COL.DATE];
      const timeStartStr = row[LAUNDRY_COL.TIME_START];
      const residentId = row[LAUNDRY_COL.RESIDENT_ID];

      if (status !== "ACTIVE" || date !== todayStr) continue;

      // Parse time (e.g., "09:00")
      const [hour, min] = timeStartStr.split(":").map(Number);
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min);

      const diffMinutes = (startTime.getTime() - now.getTime()) / 60000;

      // Notify if slot starts in 15-30 minutes
      if (diffMinutes > 0 && diffMinutes <= 30) {
        console.log(`[Reminder] Upcoming slot for ${residentId} at ${timeStartStr}`);
        await notifyResident(
          residentId,
          "Laundry Reminder",
          `Your laundry slot starts at ${timeStartStr}. Get ready!`,
          "/resident/laundry"
        );
      }
    }
  } catch (e) {
    console.error("Laundry reminders task failed:", e);
  }
}
