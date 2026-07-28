import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_DB_PROVIDER
} from "$env/static/public";

export const isSupabase = PUBLIC_DB_PROVIDER === "supabase";

export const supabase =
  PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    : null;

// ── GSheets API Client ───────────────────────────────────────────────────────

const cache = new Map<string, { data: string[][]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getAccessToken(): Promise<string> {
  const { auth } = await import("$state/auth.svelte");
  return (auth as any).accessToken || (auth as any).user?.accessToken || "";
}

export async function fetchWithAuth(
  url: string,
  errorMsg: string,
  options?: RequestInit
): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...((options?.headers as Record<string, string>) || {})
    }
  });
  if (!res.ok) {
    throw new Error(`${errorMsg}: ${res.status} ${res.statusText}`);
  }
  return res;
}

export async function fetchSheetRowsRaw(
  spreadsheetId: string,
  range: string,
  forceRefresh = false
): Promise<string[][]> {
  const key = `${spreadsheetId}::${range}`;
  const cached = cache.get(key);
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetchWithAuth(url, "Failed to fetch sheet data");
  const json = await res.json();
  const data: string[][] = json.values || [];
  cache.set(key, { data, ts: Date.now() });
  return data;
}

export async function updateSheetValue(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await fetchWithAuth(url, "Failed to update sheet", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values })
  });
  invalidateCache(spreadsheetId);
}

export async function appendSheetRow(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await fetchWithAuth(url, "Failed to append row", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ majorDimension: "ROWS", values })
  });
  invalidateCache(spreadsheetId);
}

export async function deleteSheetRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaRes = await fetchWithAuth(metaUrl, "Failed to fetch metadata");
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  const sheetId = sheet.properties.sheetId;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchWithAuth(url, "Failed to delete row", {
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
  invalidateCache(spreadsheetId);
}

export async function batchUpdateValues(
  spreadsheetId: string,
  updates: { range: string; values: any[][] }[]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  await fetchWithAuth(url, "Failed to batch update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({
        range: u.range,
        majorDimension: "ROWS",
        values: u.values
      }))
    })
  });
  invalidateCache(spreadsheetId);
}

export function invalidateCache(spreadsheetId?: string): void {
  if (spreadsheetId) {
    for (const key of cache.keys()) {
      if (key.startsWith(spreadsheetId)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

export async function createNewSpreadsheet(title: string): Promise<string> {
  const url = "https://sheets.googleapis.com/v4/spreadsheets";
  const res = await fetchWithAuth(url, "Failed to create spreadsheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } })
  });
  const json = await res.json();
  return json.spreadsheetId;
}

export async function ensureSheetExists(spreadsheetId: string, title: string): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaRes = await fetchWithAuth(metaUrl, "Failed to fetch metadata");
  const meta = await metaRes.json();
  const exists = meta.sheets?.some((s: any) => s.properties.title === title);
  if (exists) {
    return;
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchWithAuth(url, "Failed to add sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] })
  });
}

export async function formatReportSheet(
  spreadsheetId: string,
  sheetName: string,
  rowCount: number,
  colCount: number
): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaRes = await fetchWithAuth(metaUrl, "Failed to fetch metadata");
  const meta = await metaRes.json();
  const sheet = meta.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) {
    return;
  }
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
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: colCount
            }
          }
        }
      ]
    })
  });
}
