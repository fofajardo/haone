import { CRON_SECRET } from "$env/static/private";
import { runLaundryReminders } from "$lib/server/tasks/laundry-reminders";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET: Consolidated Background Task Runner
 * Executes both Laundry Reminders and Announcement Notifications.
 * Call via: /api/tasks/cron?secret=YOUR_SECRET
 */
export const GET: RequestHandler = async ({ url }) => {
  const secret = url.searchParams.get("secret");

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Laundry Reminders
    try {
      await runLaundryReminders();
      results.laundry = { success: true };
    } catch (e: any) {
      results.laundry = { success: false, error: e.message };
    }

    return json({
      success: true,
      message: "Tasks processed",
      results
    });
  } catch (e: any) {
    return json(
      {
        error: "Task runner encountered a critical failure",
        message: e.message
      },
      { status: 500 }
    );
  }
};
