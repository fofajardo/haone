import { json } from "@sveltejs/kit";
import { runAnnouncementNotifications } from "$lib/server/tasks/announcements";
import { authenticateAdmin } from "$lib/server/api-helper";
import type { RequestHandler } from "./$types";

/**
 * POST: Manually trigger announcement notifications.
 * Restricted to authenticated admins.
 */
export const POST: RequestHandler = async ({ request }) => {
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const totalSent = await runAnnouncementNotifications();
    return json({ 
      success: true, 
      message: `Notifications broadcasted successfully to ${totalSent} subscriber(s).`,
      count: totalSent
    });
  } catch (e: any) {
    return json({ error: "Broadcast failed", message: e.message }, { status: 500 });
  }
};
