import { auth } from "./auth.svelte";

export interface SheetRow {
  [key: string]: string;
}

/**
 * Enhanced fetch to return raw values as well, to help with row indexing.
 */
export async function fetchSheetRowsRaw(spreadsheetId: string, range: string): Promise<string[][]> {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || "Failed to fetch sheet data");
  }

  const data = await resp.json();
  return data.values || [];
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

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || "Failed to update sheet");
  }

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

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || "Failed to batch update sheet");
  }

  return await resp.json();
}

/**
 * Appends a row to a specific sheet.
 */
export async function appendSheetRow(spreadsheetId: string, range: string, values: any[][]) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || "Failed to append row");
  }

  return await resp.json();
}
