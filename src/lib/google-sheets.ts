import { auth } from "./auth.svelte";
import { brandingState } from "./branding.svelte";

let sheetsCache: Record<string, string[][]> = {};

/**
 * Clears the session-based Sheets data cache.
 */
export function invalidateCache() {
  sheetsCache = {};
}

/**
 * Incrementally append rows to a cached range.
 */
export function appendRowToCache(spreadsheetId: string, range: string, newRows: string[][]) {
  const cacheKey = `${spreadsheetId}:${range}`;
  if (sheetsCache[cacheKey]) {
    sheetsCache[cacheKey].push(...newRows);
  }
}

/**
 * Incrementally update a row in a cached range.
 */
export function updateRowInCache(
  spreadsheetId: string,
  range: string,
  rowIndex: number,
  updatedRow: string[]
) {
  const cacheKey = `${spreadsheetId}:${range}`;
  if (sheetsCache[cacheKey] && sheetsCache[cacheKey][rowIndex]) {
    sheetsCache[cacheKey][rowIndex] = updatedRow;
  }
}

/**
 * Incrementally remove a row from a cached range.
 */
export function deleteRowFromCache(spreadsheetId: string, range: string, rowIndex: number) {
  const cacheKey = `${spreadsheetId}:${range}`;
  if (sheetsCache[cacheKey]) {
    sheetsCache[cacheKey].splice(rowIndex, 1);
  }
}

/**
 * Standard error handling for Google API responses.
 */
async function handleResponseError(resp: Response, defaultMessage: string) {
  if (resp.status === 401) {
    auth.lastError = {
      title: "Session Expired",
      description: "Please sign in again."
    };
    auth.logout();
    throw new Error("Session expired (401)");
  }
  if (resp.status === 403) {
    const replyTo = brandingState.profile.replyTo || "";
    auth.lastError = {
      title: "Not Authorized",
      description: `You do not have permission to use this platform. Please contact the administrator via <a href="mailto:${replyTo}">email</a>.`
    };
    auth.logout();
    throw new Error("Not authorized (403)");
  }
  let message = defaultMessage;
  try {
    const err = await resp.json();
    message = err.error?.message || defaultMessage;
  } catch (e) {
    // Fallback if not JSON
  }
  throw new Error(message);
}

/**
 * Standard fetch with auth and error handling.
 */
async function fetchWithAuth(
  url: string,
  defaultError: string,
  init: RequestInit = {},
  explicitToken?: string
) {
  const token = explicitToken || auth.accessToken;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const resp = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`
    }
  });

  if (!resp.ok) {
    await handleResponseError(resp, defaultError);
  }

  return resp;
}

/**
 * Tests connectivity to a spreadsheet with an explicit token.
 * Useful for pre-login verification.
 */
export async function testAccess(spreadsheetId: string, token: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`;
  await fetchWithAuth(url, "Connection test failed", {}, token);
}

export interface SheetRow {
  [key: string]: string;
}

/**
 * Enhanced fetch to return raw values as well, to help with row indexing.
 * Includes session-based caching.
 */
export async function fetchSheetRowsRaw(
  spreadsheetId: string,
  range: string,
  forceRefresh = false
): Promise<string[][]> {
  const cacheKey = `${spreadsheetId}:${range}`;
  if (!forceRefresh && sheetsCache[cacheKey]) {
    return sheetsCache[cacheKey];
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetchWithAuth(url, "Failed to fetch sheet data");

  const data = await resp.json();
  const values = data.values || [];
  sheetsCache[cacheKey] = values;
  return values;
}

/**
 * Legacy support for object-based fetching.
 */
export async function fetchSheetData(spreadsheetId: string, range: string): Promise<SheetRow[]> {
  const rows = await fetchSheetRowsRaw(spreadsheetId, range);
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows
    .slice(1)
    .filter((row) => row[0] !== "#N/A" && row[0] !== "")
    .map((row) => {
      const obj: SheetRow = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });
}

/**
 * Updates a specific range (e.g., a cell or row) in the sheet.
 */
export async function updateSheetValue(spreadsheetId: string, range: string, values: any[][]) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const resp = await fetchWithAuth(url, "Failed to update sheet", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  return await resp.json();
}

/**
 * Performs multiple updates in a single request.
 */
export async function batchUpdateValues(
  spreadsheetId: string,
  data: { range: string; values: any[][] }[]
) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

  const resp = await fetchWithAuth(url, "Failed to batch update sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data
    })
  });

  return await resp.json();
}

/**
 * Appends a row to a specific sheet.
 */
export async function appendSheetRow(spreadsheetId: string, range: string, values: any[][]) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetchWithAuth(url, "Failed to append row", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  return await resp.json();
}

/**
 * Deletes a row from a specific sheet by its index.
 */
export async function deleteSheetRow(spreadsheetId: string, sheetName: string, rowIndex: number) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  // 1. Resolve sheetId from sheetName
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchWithAuth(metaUrl, "Failed to fetch spreadsheet metadata");

  const data = await metaResp.json();

  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

  // 2. Perform delete dimension request
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const resp = await fetchWithAuth(url, "Failed to delete row", {
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

  return await resp.json();
}

/**
 * Creates a new Google Spreadsheet.
 */
export async function createNewSpreadsheet(title: string, sheetTitle?: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets`;
  const sheets = sheetTitle ? [{ properties: { title: sheetTitle } }] : [];

  const resp = await fetchWithAuth(url, "Failed to create spreadsheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets
    })
  });
  return await resp.json();
}

/**
 * Ensures a sheet with the given title exists in the spreadsheet.
 */
export async function ensureSheetExists(spreadsheetId: string, title: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const resp = await fetchWithAuth(url, "Failed to fetch spreadsheet metadata");
  const data = await resp.json();

  const exists = data.sheets?.some((s: any) => s.properties.title === title);
  if (exists) return;

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchWithAuth(updateUrl, "Failed to create new sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title }
          }
        }
      ]
    })
  });
}

/**
 * Formats a report sheet with frozen headers, bold text, and auto-resized columns.
 */
export async function formatReportSheet(
  spreadsheetId: string,
  sheetName: string,
  rowCount: number,
  colCount: number
) {
  // 1. Resolve sheetId
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchWithAuth(metaUrl, "Failed to fetch metadata");
  const data = await metaResp.json();
  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) return;
  const sheetId = sheet.properties.sheetId;

  // 2. Apply formatting
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchWithAuth(url, "Failed to format sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount"
          }
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: colCount
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                textFormat: { bold: true, fontSize: 10 }
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)"
          }
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: colCount }
          }
        }
      ]
    })
  });
}
