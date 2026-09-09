import {
  authenticateResident,
  fetchGoogleAPI,
  getFirebaseToken,
  serverError
} from "$api/services/server-sheets-service";
import { GOOGLE_SERVICE_ACCOUNT_JSON } from "$env/static/private";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
const PROJECT_ID = keys.project_id;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/push_subscriptions`;

/**
 * Helper to hash endpoint into a valid Firestore document ID
 */
async function getDocId(endpoint: string) {
  const msgUint8 = new TextEncoder().encode(endpoint);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * POST: Save a new push subscription
 */
export const POST: RequestHandler = async ({ request }) => {
  const { residentId, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const { endpoint, p256dh, auth } = await request.json();
    if (!endpoint) return json({ error: "Missing endpoint" }, { status: 400 });

    const token = await getFirebaseToken();
    const docId = await getDocId(endpoint);

    const payload = {
      fields: {
        residentId: { stringValue: residentId },
        endpoint: { stringValue: endpoint },
        p256dh: { stringValue: p256dh || "" },
        auth: { stringValue: auth || "" },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    };

    const updateMask =
      "updateMask.fieldPaths=residentId&updateMask.fieldPaths=endpoint&updateMask.fieldPaths=p256dh&updateMask.fieldPaths=auth&updateMask.fieldPaths=createdAt";
    await fetchGoogleAPI(`${BASE_URL}/${docId}?${updateMask}`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Push subscription save (Firebase)");
  }
};

/**
 * DELETE: Remove a push subscription
 */
export const DELETE: RequestHandler = async ({ url, request }) => {
  const { error: authError } = await authenticateResident(request);
  if (authError) return authError;

  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) return json({ error: "Missing endpoint" }, { status: 400 });

  try {
    const token = await getFirebaseToken();
    const docId = await getDocId(endpoint);

    await fetchGoogleAPI(`${BASE_URL}/${docId}`, token, {
      method: "DELETE"
    });

    return json({ success: true });
  } catch (e: any) {
    // If 404, consider success
    if (e.message.includes("404")) return json({ success: true });
    return serverError(e, "Push subscription delete (Firebase)");
  }
};
