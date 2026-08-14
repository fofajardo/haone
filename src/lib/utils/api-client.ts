import { auth } from "$state/auth.svelte";

let serverCache: Record<string, any> = {};

/**
 * Clears the server API data cache.
 */
export function invalidateServerCache() {
  serverCache = {};
}

/**
 * Unified fetch wrapper for server API calls.
 * Automatically injects auth token and handles 401 unauthorized errors.
 * Includes session-based caching.
 */
export async function fetchServer<T = any>(
  url: string,
  options: RequestInit = {},
  bypassCache = false
): Promise<T> {
  const isLaundry = url.includes("/api/resident/laundry");
  const useCache = options.method === "GET" || !options.method;

  if (!bypassCache && !isLaundry && useCache && serverCache[url]) {
    return serverCache[url] as T;
  }

  const headers = new Headers(options.headers || {});
  if (auth.accessToken) {
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    auth.logout();
    throw new Error("Session expired. Please sign in again.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      (typeof data?.error === "string" ? data.error : null) ||
      (typeof data?.message === "string" ? data.message : null) ||
      `Server error: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  if (!isLaundry && useCache) {
    serverCache[url] = data;
  }

  return data as T;
}
