import { SUPABASE_SECRET_KEY } from "$env/static/private";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { createClient } from "@supabase/supabase-js";
import { json } from "@sveltejs/kit";

/**
 * Returns a server-side Supabase client authenticated with the secret service role key.
 */
export function getSupabaseAdmin() {
  return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY);
}

/**
 * Standardized 500 JSON error response for server API routes.
 */
export function serverError(e: any, context = "API Operation") {
  console.error(`${context} failed:`, e);
  const message = typeof e === "string" ? e : e?.message || "Unknown error";
  return json({ error: "server_error", message }, { status: 500 });
}
