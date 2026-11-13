import { authenticateResident } from "$api/services/auth-service";
import { serverError } from "$api/services/server-google-service";
import { getSupabaseAdmin } from "$api/services/server-service";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Helper to hash endpoint into a deterministic subscription ID
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
  if (authError) {
    return authError;
  }

  try {
    const { endpoint, p256dh, auth } = await request.json();
    if (!endpoint) {
      return json({ error: "Missing endpoint" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const id = await getDocId(endpoint);

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        id,
        resident_id: residentId,
        endpoint,
        p256dh: p256dh || "",
        auth: auth || "",
        created_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (error) {
      throw new Error(error.message);
    }

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Push subscription save (Supabase)");
  }
};

/**
 * DELETE: Remove a push subscription
 */
export const DELETE: RequestHandler = async ({ url, request }) => {
  const { error: authError } = await authenticateResident(request);
  if (authError) {
    return authError;
  }

  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) {
    return json({ error: "Missing endpoint" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const id = await getDocId(endpoint);

    const { error } = await supabase.from("push_subscriptions").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Push subscription delete (Supabase)");
  }
};
