import { json } from "@sveltejs/kit";

/**
 * Generic fetch wrapper for Google APIs with Bearer auth and error handling.
 */
export async function fetchGoogleAPI(url: string, token: string, options: RequestInit = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  });

  if (!resp.ok) {
    if (resp.status === 429) {
      throw new Error("Too many people are using the platform right now. Please try again later.");
    }
    const err = await resp.text();
    throw new Error(`Google API Error (${resp.status}): ${err}`);
  }

  return resp;
}

/**
 * Standardized error response for API routes.
 */
export function serverError(e: any, context = "API Operation") {
  console.error(`${context} failed:`, e);
  const message = typeof e === "string" ? e : e?.message || "Unknown error";
  return json({ error: "server_error", message }, { status: 500 });
}

export const serverGoogleService = {
  fetchGoogleAPI,
  serverError
};
