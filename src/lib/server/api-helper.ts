import { json } from "@sveltejs/kit";
import { GOOGLE_SERVICE_ACCOUNT_JSON } from "$env/static/private";
import { JWT } from "google-auth-library";

/**
 * Creates an authorized Google Sheets client using the service account.
 */
export async function getSheetsClient() {
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const client = new JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return client;
}

/**
 * Fetches values from a spreadsheet range.
 */
export async function getSheetValues(client: JWT, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await client.request({ url });
  return (resp.data as any).values || [];
}

/**
 * Appends values to a spreadsheet range.
 */
export async function appendSheetValue(
  client: JWT,
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await client.request({
    url,
    method: "POST",
    data: { values }
  });
  return resp.data;
}

/**
 * Standardized resident authentication for API routes.
 * Verifies the Bearer token with Google and returns the user's email.
 */
export async function authenticateResident(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.split(" ")[1];

  try {
    const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!userinfoResp.ok) {
      return { error: json({ error: "Invalid token" }, { status: 401 }) };
    }

    const userData = await userinfoResp.json();
    return { email: userData.email.trim().toLowerCase() };
  } catch (e: any) {
    console.error("Auth validation failed:", e);
    return {
      error: json({ error: "Authentication check failed", message: e.message }, { status: 500 })
    };
  }
}

/**
 * Standardized error response for API routes.
 */
export function serverError(e: any, context = "API Operation") {
  console.error(`${context} failed:`, e);
  return json({ error: "server_error", message: e.message }, { status: 500 });
}
