import {
  authenticateAdmin,
  authenticateResident,
  base64url,
  getFirebaseToken,
  getServiceAccountToken,
  getSheetsClient,
  resolveResidentAccountType,
  sign
} from "$api/services/auth-service";
import { json } from "@sveltejs/kit";

export {
  authenticateAdmin,
  authenticateResident,
  base64url,
  getFirebaseToken,
  getServiceAccountToken,
  getSheetsClient,
  resolveResidentAccountType,
  sign
};

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
      // Google API rate limit exceeded. This is user-facing, so we should provide a clear message.
      throw new Error("Too many people are using the platform right now. Please try again later.");
    }
    const err = await resp.text();
    throw new Error(`Google API Error (${resp.status}): ${err}`);
  }

  return resp;
}

/**
 * Fetches values from a spreadsheet range.
 */
export async function getSheetValues(token: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetchGoogleAPI(url, token);
  const data = await resp.json();
  return data.values || [];
}

/**
 * Appends values to a spreadsheet range.
 */
export async function appendSheetValue(
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetchGoogleAPI(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  return await resp.json();
}

/**
 * Updates values in a spreadsheet range.
 */
export async function updateSheetValue(
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetchGoogleAPI(url, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  return await resp.json();
}

/**
 * Deletes a row from a specific sheet.
 */
export async function deleteSheetRow(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
) {
  // 1. Resolve sheetId
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchGoogleAPI(metaUrl, token);
  const data = await metaResp.json();
  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

  // 2. Delete dimension
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchGoogleAPI(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    })
  });
}

/**
 * Standardized error response for API routes.
 */
export function serverError(e: any, context = "API Operation") {
  console.error(`${context} failed:`, e);
  return json({ error: "server_error", message: e.message }, { status: 500 });
}

export async function getSpreadsheetIdForSheet(sheetName: string): Promise<string> {
  const { PUBLIC_GS_SR_ID, PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID } = await import("$env/static/public");
  switch (sheetName) {
    case "laundry":
    case "achievements":
    case "achievement_records":
    case "settings":
    case "payment_requests":
    case "announcements":
    case "static_ip":
    case "fridge_items":
      return PUBLIC_GS_SR_ID;
    case "constants":
    case "accounts":
    case "journal_general":
      return PUBLIC_GS_AW_ID;
    case "users":
    case "directory":
    case "CURR":
      return PUBLIC_GS_RR_ID;
    default:
      throw new Error(`Unknown sheet name: ${sheetName}`);
  }
}

/**
 * Fetches multiple ranges from Google Sheets, including special handling for "TERM_CURR".
 * Returns an array of results corresponding to the input ranges.
 * If a range is "TERM_CURR", it fetches the value from the constants sheet.
 * Otherwise, it fetches the values from the specified sheet and range.
 */
export async function fetchSheetsData(token: string, ranges: string[]): Promise<any[]> {
  const promises = ranges.map(async (range) => {
    if (range === "TERM_CURR") {
      const spreadsheetId = await getSpreadsheetIdForSheet("constants");
      const values = await getSheetValues(token, spreadsheetId, "constants!A:C");
      const row = values.find((r: any) => (r[0] || "").trim() === "TERM_CURR");
      return row ? (row[1] || "").trim() : "";
    }
    const sheetName = range.split("!")[0];
    const spreadsheetId = await getSpreadsheetIdForSheet(sheetName);
    return getSheetValues(token, spreadsheetId, range);
  });
  return Promise.all(promises);
}

export const serverSheetsService = {
  fetchGoogleAPI,
  getSheetValues,
  appendSheetValue,
  updateSheetValue,
  deleteSheetRow,
  serverError,
  getSpreadsheetIdForSheet,
  fetchSheetsData
};
