import { getFirebaseToken } from "$api/services/auth-service";
import { fetchGoogleAPI } from "$api/services/server-google-service";
import { GOOGLE_SERVICE_ACCOUNT_JSON, VAPID_PRIVATE_KEY } from "$env/static/private";
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

const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
const PROJECT_ID = keys.project_id;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
    const token = await getFirebaseToken();

    // Query Firestore for subscriptions matching residentId
    const query = {
      structuredQuery: {
        from: [{ collectionId: "push_subscriptions" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "residentId" },
            op: "EQUAL",
            value: { stringValue: residentId }
          }
        }
      }
    };

    const resp = await fetchGoogleAPI(`${BASE_URL}:runQuery`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query)
    });

    const results = await resp.json();

    for (const result of results) {
      if (!result.document) {
        continue;
      }

      const docName = result.document.name;
      const fields = result.document.fields;
      const endpoint = fields.endpoint?.stringValue;
      const p256dh = fields.p256dh?.stringValue;
      const auth = fields.auth?.stringValue;

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
            await fetchGoogleAPI(`https://firestore.googleapis.com/v1/${docName}`, token, {
              method: "DELETE"
            });
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
    const token = await getFirebaseToken();
    const resp = await fetchGoogleAPI(`${BASE_URL}/push_subscriptions?pageSize=1000`, token);
    const data = await resp.json();

    if (!data.documents) {
      return { sentCount: 0, foundCount: 0 };
    }

    const foundCount = data.documents.length;
    let sentCount = 0;

    for (const doc of data.documents) {
      const docName = doc.name;
      const fields = doc.fields;
      const endpoint = fields.endpoint?.stringValue;
      const p256dh = fields.p256dh?.stringValue;
      const auth = fields.auth?.stringValue;

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
            await fetchGoogleAPI(`https://firestore.googleapis.com/v1/${docName}`, token, {
              method: "DELETE"
            });
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
