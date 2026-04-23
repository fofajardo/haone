import { json } from "@sveltejs/kit";
import { runLaundryReminders } from "$lib/server/tasks/laundry-reminders";
import { runAnnouncementNotifications } from "$lib/server/tasks/announcements";
import { CRON_SECRET } from "$env/static/private";
import type { RequestHandler } from "./$types";

/**
 * GET: Trigger all background tasks
 * Should be called by a Cron job with ?secret=...
 */
export const GET: RequestHandler = async ({ url }) => {
  const secret = url.searchParams.get("secret");

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Run all tasks
    await Promise.allSettled([runLaundryReminders(), runAnnouncementNotifications()]);

    return json({ success: true, message: "Tasks processed" });
  } catch (e: any) {
    return json({ error: "Tasks failed", message: e.message }, { status: 500 });
  }
};
