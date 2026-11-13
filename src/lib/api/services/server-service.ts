import { SUPABASE_SECRET_KEY } from "$env/static/private";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { createClient } from "@supabase/supabase-js";

/**
 * Returns a server-side Supabase client authenticated with the secret service role key.
 */
export function getSupabaseAdmin() {
  return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY);
}
