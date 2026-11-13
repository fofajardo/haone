import { getSupabaseAdmin } from "$api/services/common";
import { VAPID_PRIVATE_KEY } from "$env/static/private";
import {
  PUBLIC_BRANDING,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL,
  PUBLIC_VAPID_PUBLIC_KEY
} from "$env/static/public";
import { AnnouncementStatus } from "$lib/types";
import branding from "$srcPrivate/branding.json";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys
} from "@block65/webcrypto-web-push";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const brandingProfile = (branding as any)[PUBLIC_BRANDING];

/**
 * Sends a push notification to a specific resident.
 */
export async function notifyResident(
  residentId: string,
  title: string,
  body: string,
  url: string = "/resident/laundry"
) {
  if (!PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID keys not configured");
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("resident_id", residentId);

    if (error) {
      throw new Error(error.message);
    }

    for (const sub of subscriptions || []) {
      const { id, endpoint, p256dh, auth } = sub;

      if (!endpoint || !p256dh || !auth) {
        continue;
      }

      const subscription: PushSubscription = {
        endpoint,
        expirationTime: null,
        keys: { p256dh, auth }
      };

      const message: PushMessage = {
        data: JSON.stringify({ title, body, url }),
        options: { ttl: 86400 }
      };
      const vapid: VapidKeys = {
        subject: `mailto:${brandingProfile.replyTo}`,
        publicKey: PUBLIC_VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      };

      try {
        const payload = await buildPushPayload(message, subscription, vapid);
        const pushResp = await fetch(endpoint, payload as any);

        if (!pushResp.ok) {
          if (pushResp.status === 404 || pushResp.status === 410) {
            console.warn(`[Push] Subscription expired for ${residentId}, deleting.`);
            await supabase.from("push_subscriptions").delete().eq("id", id);
          }
        }
      } catch (err: any) {
        console.error("Push delivery failed:", err);
      }
    }
  } catch (e) {
    console.error("NotifyResident failed:", e);
  }
}

/**
 * Sends a push notification to all subscribers.
 */
export async function notifyAllResidents(
  title: string,
  body: string,
  url: string = "/resident/announcements"
): Promise<{ sentCount: number; foundCount: number }> {
  if (!PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sentCount: 0, foundCount: 0 };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (error) {
      throw new Error(error.message);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { sentCount: 0, foundCount: 0 };
    }

    const foundCount = subscriptions.length;
    let sentCount = 0;

    for (const sub of subscriptions) {
      const { id, endpoint, p256dh, auth } = sub;

      if (!endpoint || !p256dh || !auth) {
        continue;
      }

      const subscription: PushSubscription = {
        endpoint,
        expirationTime: null,
        keys: { p256dh, auth }
      };

      const message: PushMessage = {
        data: JSON.stringify({ title, body, url }),
        options: { ttl: 86400 }
      };
      const vapid: VapidKeys = {
        subject: `mailto:${brandingProfile.replyTo}`,
        publicKey: PUBLIC_VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      };

      try {
        const payload = await buildPushPayload(message, subscription, vapid);
        const pushResp = await fetch(endpoint, payload as any);

        if (pushResp.ok) {
          sentCount++;
        } else {
          const errorText = await pushResp.text();
          console.error(`[Push] Delivery failed (${pushResp.status}): ${errorText}`);
          if (pushResp.status === 404 || pushResp.status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", id);
          }
        }
      } catch (err: any) {
        console.error("Push delivery failed:", err);
      }
    }
    return { sentCount, foundCount };
  } catch (e) {
    console.error("NotifyAllResidents failed:", e);
    return { sentCount: 0, foundCount: 0 };
  }
}

/**
 * Task to check for newly active announcements and notify residents.
 */
export async function runAnnouncementNotifications(ids?: string[]): Promise<number> {
  let totalSent = 0;
  try {
    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    let query = supabase.from("announcements").select("*");
    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    }

    const { data: rows, error: annErr } = await query;
    if (annErr) {
      console.error("Failed to fetch announcements for notification:", annErr);
      return 0;
    }
    if (!rows || rows.length === 0) {
      return 0;
    }

    const now = dayjs();
    console.log(`[Announcement Task] Processing ${rows.length} rows. Filter IDs:`, ids);

    for (const row of rows) {
      const id = row.id;
      const title = row.title || "";
      const slug = row.slug || id;
      const start = row.start_date ? dayjs(row.start_date) : null;
      const expiry = row.expiry_date ? dayjs(row.expiry_date) : null;
      const isIndefinite = row.is_indefinite === true;
      const broadcastCount = row.broadcast_count || 0;
      const isUnlisted = row.is_unlisted === true;

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

        const content = row.content || "";
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

        // Increment broadcast count in Supabase only if at least one notification was sent
        if (sentCount > 0) {
          await supabase
            .from("announcements")
            .update({ broadcast_count: broadcastCount + 1 })
            .eq("id", id);
        }
      }
    }
    return totalSent;
  } catch (e) {
    console.error("Announcement notifications task failed:", e);
    return totalSent;
  }
}

/**
 * Task to check for upcoming laundry slots and send reminders.
 */
export async function runLaundryReminders() {
  try {
    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const { data: rows, error: laundryErr } = await supabase
      .from("laundry")
      .select("*")
      .eq("status", "ACTIVE")
      .eq("date", todayStr);

    if (laundryErr) {
      console.error("Failed to fetch laundry slots for reminder:", laundryErr);
      return;
    }
    if (!rows || rows.length === 0) {
      return;
    }

    // Process rows
    for (const row of rows) {
      const timeStartStr = row.time_start;
      const residentId = row.resident_id;

      if (!timeStartStr || !residentId) {
        continue;
      }

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

export const notificationsController = {
  notifyResident,
  notifyAllResidents,
  runAnnouncementNotifications,
  runLaundryReminders
};
