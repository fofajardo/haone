import { authenticateAdmin } from "$api/services/server-sheets-service";
import { runAnnouncementNotifications } from "$lib/server/tasks/announcements";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * POST: Manually trigger announcement notifications.
 * Restricted to authenticated admins.
 */
export const POST: RequestHandler = async ({ request }) => {
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : undefined;
    console.log(`[Broadcast API] Triggering for IDs:`, ids);

    const totalSent = await runAnnouncementNotifications(ids);
    return json({
      success: true,
      message: `Notifications broadcasted successfully to ${totalSent} subscriber(s).`,
      count: totalSent
    });
  } catch (e: any) {
    return json({ error: "Broadcast failed", message: e.message }, { status: 500 });
  }
};
