import { uiSettings } from "$state/settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow
} from "$api/services/google-sheets-service";
import { fetchServer } from "$utils/api-client";
import { LAUNDRY_COL, type LaundryRecord } from "$lib/types";
import { parseTime } from "$utils/parsers";

/**
 * Resident API Methods (Proxy via server API)
 */
export async function fetchLaundryReservations(
  forceRefresh = false
): Promise<LaundryRecord[] | { reservations: LaundryRecord[]; currentResidentId: string }> {
  const data = await fetchServer("/api/resident/laundry", {}, forceRefresh);
  return {
    reservations: data.reservations,
    currentResidentId: data.currentResidentId
  };
}

export async function addLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  return await fetchServer("/api/resident/laundry", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function cancelLaundryReservation(
  reservationId: string,
  _reason: string,
  _status: any = null
) {
  return await fetchServer(`/api/resident/laundry?id=${reservationId}`, {
    method: "DELETE"
  });
}

/**
 * Admin Direct Methods (Direct Google Sheets API)
 */
export async function fetchAdminLaundryReservations(
  forceRefresh = false
): Promise<LaundryRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    return [];
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "laundry!A:I", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[LAUNDRY_COL.ID] || "").trim(),
    residentId: (row[LAUNDRY_COL.RESIDENT_ID] || "").trim(),
    date: (row[LAUNDRY_COL.DATE] || "").trim(),
    timeStart: (row[LAUNDRY_COL.TIME_START] || "").trim(),
    timeEnd: (row[LAUNDRY_COL.TIME_END] || "").trim(),
    status: (row[LAUNDRY_COL.STATUS] || "").trim(),
    cancelReason: (row[LAUNDRY_COL.CANCEL_REASON] || "").trim(),
    creationTimestamp: (row[LAUNDRY_COL.CREATION_TIMESTAMP] || "").trim(),
    cancelTimestamp: (row[LAUNDRY_COL.CANCEL_TIMESTAMP] || "").trim(),
    raw: row
  }));
}

export async function addAdminLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const startH = parseTime(data.timeStart);
  const endH = parseTime(data.timeEnd);
  const [y, m, d] = data.date.split("-").map(Number);
  const start = new Date(y, m - 1, d, startH);
  const end = new Date(y, m - 1, d, endH);

  if (start >= end) {
    throw new Error("Start time must be before end time.");
  }

  const opStart = 5;
  const opEnd = 22;
  if (
    start.getHours() < opStart ||
    end.getHours() > opEnd ||
    (end.getHours() === opEnd && end.getMinutes() > 0)
  ) {
    throw new Error("Laundry facility is only open from 5:00 AM to 10:00 PM.");
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs > 2 * 60 * 60 * 1000) {
    throw new Error("Maximum of two (2) hours for any reservation.");
  }

  // Overlap Check
  const existing = await fetchAdminLaundryReservations(true);
  const isOverlapping = existing.some((r) => {
    if (r.status !== "ACTIVE" || r.date !== data.date) {
      return false;
    }
    const rStart = new Date(`${r.date}T${r.timeStart}`);
    const rEnd = new Date(`${r.date}T${r.timeEnd}`);
    return start < rEnd && end > rStart;
  });

  if (isOverlapping) {
    throw new Error("This slot overlaps with an existing reservation.");
  }

  const row = new Array(9).fill("");
  row[LAUNDRY_COL.ID] = data.id || crypto.randomUUID();
  row[LAUNDRY_COL.RESIDENT_ID] = data.residentId;
  row[LAUNDRY_COL.DATE] = data.date;
  row[LAUNDRY_COL.TIME_START] = data.timeStart;
  row[LAUNDRY_COL.TIME_END] = data.timeEnd;
  row[LAUNDRY_COL.STATUS] = data.status || "ACTIVE";
  row[LAUNDRY_COL.CANCEL_REASON] = data.cancelReason || "";
  row[LAUNDRY_COL.CREATION_TIMESTAMP] = new Date().toISOString();
  row[LAUNDRY_COL.CANCEL_TIMESTAMP] = "";

  await appendSheetRow(spreadsheetId, "laundry!A:I", [row]);
}

export async function cancelAdminLaundryReservation(
  reservationId: string,
  reason: string,
  status: "CANCELLED_BY_USER" | "CANCELLED_BY_ADMIN" = "CANCELLED_BY_ADMIN"
) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "laundry!A:I");
  const rowIndex = rows.findIndex((r) => (r[LAUNDRY_COL.ID] || "").trim() === reservationId);
  if (rowIndex === -1) {
    throw new Error("Reservation not found");
  }

  const actualRow = rowIndex + 1;
  await Promise.all([
    updateSheetValue(spreadsheetId, `laundry!F${actualRow}`, [[status]]),
    updateSheetValue(spreadsheetId, `laundry!G${actualRow}`, [[reason]]),
    updateSheetValue(spreadsheetId, `laundry!I${actualRow}`, [[new Date().toISOString()]])
  ]);
}
