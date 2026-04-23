import { PUBLIC_VAPID_PUBLIC_KEY } from "$env/static/public";
import { VAPID_PRIVATE_KEY } from "$env/static/private";
import { GOOGLE_SERVICE_ACCOUNT_JSON } from "$env/static/private";
import {
  buildPushPayload,
  type PushSubscription,
  type PushMessage,
  type VapidKeys
} from "@block65/webcrypto-web-push";
import { getFirebaseToken, fetchGoogleAPI } from "$lib/server/api-helper";
import branding from "$lib/branding.json";

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
      if (!result.document) continue;

      const docName = result.document.name;
      const fields = result.document.fields;
      const endpoint = fields.endpoint?.stringValue;
      const p256dh = fields.p256dh?.stringValue;
      const auth = fields.auth?.stringValue;

      if (!endpoint || !p256dh || !auth) continue;

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
        subject: `mailto:${branding.default.replyTo}`,
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
) {
  if (!PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    const token = await getFirebaseToken();
    const resp = await fetchGoogleAPI(`${BASE_URL}?pageSize=1000`, token);
    const data = await resp.json();

    if (!data.documents) return;

    for (const doc of data.documents) {
      const docName = doc.name;
      const fields = doc.fields;
      const endpoint = fields.endpoint?.stringValue;
      const p256dh = fields.p256dh?.stringValue;
      const auth = fields.auth?.stringValue;

      if (!endpoint || !p256dh || !auth) continue;

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
        subject: `mailto:${branding.default.replyTo}`,
        publicKey: PUBLIC_VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      };

      try {
        const payload = await buildPushPayload(message, subscription, vapid);
        const pushResp = await fetch(endpoint, payload as any);

        if (!pushResp.ok) {
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
  } catch (e) {
    console.error("NotifyAllResidents failed:", e);
  }
}
