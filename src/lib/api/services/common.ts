import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import { auth } from "$state/auth.svelte";
import { createClient } from "@supabase/supabase-js";

export function handleSupabaseError(error: any) {
  if (!error) {
    return;
  }
  const status = error.status || error.code;
  const msg = (error.message || "").toLowerCase();
  // Only a 401 / invalid JWT means the Supabase session is dead. A 403 is an
  // RLS denial for the current action and must NOT tear down the session.
  if (
    status === 401 ||
    status === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid token")
  ) {
    auth.signOutWithMessage(
      "Session Expired",
      "Your session or authorization is invalid. Please sign in again."
    );
    throw new Error("Your session or authorization is invalid. Please sign in again.");
  }
  throw error;
}

/**
 * Throws `message` when a Supabase mutation matched zero rows.
 */
export function assertSupabaseFound(data: any[] | null, message: string) {
  if (!data || data.length === 0) {
    throw new Error(message);
  }
}

const SUPABASE_PAGE_SIZE = 1000;

/**
 * Fetches ALL rows of a Supabase query, paging past the PostgREST default
 * 1000-row cap. The query built by `buildQuery` MUST include a deterministic
 * `.order()` for stable pagination.
 */
export async function fetchAllSupabaseRows<T = any>(buildQuery: () => any): Promise<T[]> {
  if (!supabase) {
    return [];
  }
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      handleSupabaseError(error);
    }
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
    from += SUPABASE_PAGE_SIZE;
  }
  return all;
}

export const supabase =
  PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (url, options) => {
            const response = await fetch(url, options);
            if (response.status === 401) {
              auth.signOutWithMessage(
                "Session Expired",
                "Your session has expired. Please sign in again."
              );
            }
            return response;
          }
        }
      })
    : null;
