import {
  fetchGoogleAPI,
  getFirebaseToken,
  getSheetsClient,
  getSheetValues,
  updateSheetValue
} from "$api/services/server-sheets-service";
import branding from "$dataPrivate/branding.json";
import { GOOGLE_SERVICE_ACCOUNT_JSON, VAPID_PRIVATE_KEY } from "$env/static/private";
import { PUBLIC_BRANDING, PUBLIC_GS_SR_ID, PUBLIC_VAPID_PUBLIC_KEY } from "$env/static/public";
import { ANNOUNCEMENT_COL, AnnouncementStatus, LAUNDRY_COL } from "$lib/types";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys
} from "@block65/webcrypto-web-push";
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
    const client = await getSheetsClient();

    // Fetch all announcements
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "announcements!A:M");
    if (!rows || rows.length <= 1) {
      return 0;
    }

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

/**
 * Task to check for upcoming laundry slots and send reminders.
 */
export async function runLaundryReminders() {
  try {
    const client = await getSheetsClient();
    // Fetch all laundry reservations
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "laundry!A:K");
    if (!rows || rows.length <= 1) {
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Process rows
    for (const row of rows.slice(1)) {
      const status = row[LAUNDRY_COL.STATUS];
      const date = row[LAUNDRY_COL.DATE];
      const timeStartStr = row[LAUNDRY_COL.TIME_START];
      const residentId = row[LAUNDRY_COL.RESIDENT_ID];

      if (status !== "ACTIVE" || date !== todayStr) {
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
