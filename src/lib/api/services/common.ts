import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_DB_PROVIDER
} from "$env/static/public";
import { auth } from "$state/auth.svelte";
import { brandingState } from "$state/branding.svelte";

export const isSupabase = PUBLIC_DB_PROVIDER === "supabase";

export function handleSupabaseError(error: any) {
  if (!error) return;
  const status = error.status || error.code;
  const msg = (error.message || "").toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    status === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid token") ||
    msg.includes("not authorized") ||
    msg.includes("permission denied")
  ) {
    auth.lastError = {
      title: "Session Expired",
      description: "Your session or authorization is invalid. Please sign in again."
    };
    auth.logout();
    throw new Error("Session expired or unauthorized");
  }
  throw error;
}

export const supabase =
  PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (url, options) => {
            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) {
              auth.lastError = {
                title: response.status === 403 ? "Not Authorized" : "Session Expired",
                description:
                  response.status === 403
                    ? "You do not have permission for this action."
                    : "Please sign in again."
              };
              auth.logout();
            }
            return response;
          }
        }
      })
    : null;

// ── GSheets API Client ───────────────────────────────────────────────────────

let sheetsCache: Record<string, string[][]> = {};

/**
 * Clears the session-based Sheets data cache.
 */
export function invalidateCache() {
  sheetsCache = {};
}

/**
 * Incrementally remove a row from all cached ranges for a specific sheet.
 */
function deleteRowFromCache(spreadsheetId: string, sheetName: string, rowIndex: number) {
  const prefix = `${spreadsheetId}:${sheetName}!`;
  for (const cacheKey in sheetsCache) {
    if (cacheKey.startsWith(prefix)) {
      if (sheetsCache[cacheKey] && sheetsCache[cacheKey][rowIndex]) {
        sheetsCache[cacheKey].splice(rowIndex, 1);
      }
    }
  }
}

/**
 * Converts Column Letter (A, B, AA) to 0-indexed number.
 */
function colToNum(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num - 1;
}

/**
 * Converts 0-indexed column number to Column Letter.
 */
function numToCol(num: number): string {
  let col = "";
  let n = num + 1;
  while (n > 0) {
    let m = (n - 1) % 26;
    col = String.fromCharCode(65 + m) + col;
    n = Math.floor((n - m) / 26);
  }
  return col;
}

/**
 * Surgically update a single cell in any cached range for a given sheet.
 */
export function patchCacheCell(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  colIndex: number,
  value: string
) {
  patchCacheRange(spreadsheetId, `${sheetName}!${numToCol(colIndex)}${rowIndex + 1}`, [[value]]);
}

/**
 * Surgically update a range of cells in any cached range for a given sheet.
 */
export function patchCacheRange(spreadsheetId: string, range: string, values: any[][]) {
  const parts = range.split("!");
  if (parts.length !== 2) return;
  const sheetName = parts[0];
  const a1Range = parts[1];

  const startMatch = a1Range.match(/([A-Z]+)([0-9]+)/);
  if (!startMatch) return;

  const startCol = colToNum(startMatch[1]);
  const startRow = parseInt(startMatch[2]) - 1;

  const prefix = `${spreadsheetId}:${sheetName}!`;

  for (const cacheKey in sheetsCache) {
    if (cacheKey.startsWith(prefix)) {
      const data = sheetsCache[cacheKey];
      if (!data) continue;

      for (let r = 0; r < values.length; r++) {
        const targetRow = startRow + r;

        while (targetRow > data.length) {
          data.push(new Array(data[0]?.length || 0).fill(""));
        }

        if (targetRow === data.length) {
          const rowLength = Math.max(data[0]?.length || 0, startCol + values[r].length);
          const newRow = new Array(rowLength).fill("");
          for (let c = 0; c < values[r].length; c++) {
            const targetCol = startCol + c;
            newRow[targetCol] = String(values[r][c]);
          }
          data.push(newRow);
        } else if (data[targetRow]) {
          const requiredLength = startCol + values[r].length;
          if (data[targetRow].length < requiredLength) {
            const padding = new Array(requiredLength - data[targetRow].length).fill("");
            data[targetRow].push(...padding);
          }
          for (let c = 0; c < values[r].length; c++) {
            const targetCol = startCol + c;
            data[targetRow][targetCol] = String(values[r][c]);
          }
        }
      }
    }
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
  if (resp.status === 429) {
    throw new Error("Too many requests. Please wait a moment before trying again.");
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
export async function fetchWithAuth(
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
  forceRefresh = false,
  explicitToken?: string
): Promise<string[][]> {
  const cacheKey = `${spreadsheetId}:${range}`;
  if (!forceRefresh && sheetsCache[cacheKey]) {
    return sheetsCache[cacheKey];
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetchWithAuth(url, "Failed to fetch sheet data", {}, explicitToken);

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

  const res = await resp.json();
  patchCacheRange(spreadsheetId, range, values);
  return res;
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

  const res = await resp.json();
  if (data && Array.isArray(data)) {
    for (const update of data) {
      patchCacheRange(spreadsheetId, update.range, update.values);
    }
  }
  return res;
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

  const res = await resp.json();
  if (res.updates?.updatedRange) {
    patchCacheRange(spreadsheetId, res.updates.updatedRange, values);
  }
  return res;
}

/**
 * Deletes a row from a specific sheet by its index.
 */
export async function deleteSheetRow(spreadsheetId: string, sheetName: string, rowIndex: number) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchWithAuth(metaUrl, "Failed to fetch spreadsheet metadata");

  const data = await metaResp.json();

  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

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

  const res = await resp.json();
  deleteRowFromCache(spreadsheetId, sheetName, rowIndex);
  return res;
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
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchWithAuth(metaUrl, "Failed to fetch metadata");
  const data = await metaResp.json();
  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) return;
  const sheetId = sheet.properties.sheetId;

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
