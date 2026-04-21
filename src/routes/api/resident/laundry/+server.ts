import { json } from "@sveltejs/kit";
import { PUBLIC_GS_SR_ID, PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID } from "$env/static/public";
import { LAUNDRY_COL, ACCOUNT_COL, USER_COL } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  getSheetValues,
  appendSheetValue,
  serverError
} from "$lib/server/api-helper";
import { parseTime, formatTime } from "$lib/receipt-utils";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch all reservations + user room mapping
 */
export const GET: RequestHandler = async ({ request }) => {
  const { error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();
    
    const [resRows, accRows, userRows] = await Promise.all([
      getSheetValues(client, PUBLIC_GS_SR_ID, "laundry!A:I"),
      getSheetValues(client, PUBLIC_GS_AW_ID, "accounts!A:E"),
      getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P")
    ]);

    // Build room map
    const roomMap = new Map<string, string>();
    accRows.slice(1).forEach((row: any) => {
      const rid = (row[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const room = (row[ACCOUNT_COL.ROOM] || "").trim();
      if (rid && room) {
        roomMap.set(rid, room);
        roomMap.set(rid.toLowerCase(), room);
      }
    });

    const users = userRows.slice(1).map((u: any) => ({
      id: (u[USER_COL.ID] || "").trim(),
      email: (u[USER_COL.EMAIL] || "").trim(),
      displayName: (u[USER_COL.DISPLAY_NAME] || "").trim(),
      room: roomMap.get((u[USER_COL.ID] || "").trim()) || roomMap.get((u[USER_COL.EMAIL] || "").trim().toLowerCase()) || ""
    }));

    const reservations = resRows.slice(1).map((row: any) => ({
      id: (row[LAUNDRY_COL.ID] || "").trim(),
      residentId: (row[LAUNDRY_COL.RESIDENT_ID] || "").trim(),
      date: (row[LAUNDRY_COL.DATE] || "").trim(),
      timeStart: (row[LAUNDRY_COL.TIME_START] || "").trim(),
      timeEnd: (row[LAUNDRY_COL.TIME_END] || "").trim(),
      status: (row[LAUNDRY_COL.STATUS] || "").trim(),
      cancelReason: (row[LAUNDRY_COL.CANCEL_REASON] || "").trim(),
      creationTimestamp: (row[LAUNDRY_COL.CREATION_TIMESTAMP] || "").trim(),
      cancelTimestamp: (row[LAUNDRY_COL.CANCEL_TIMESTAMP] || "").trim()
    }));

    return json({ reservations, users });
  } catch (e: any) {
    return serverError(e, "Laundry fetch");
  }
};

/**
 * POST: Add a new reservation
 */
export const POST: RequestHandler = async ({ request }) => {
  const { email: authEmail, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const data = await request.json();
    const { date, timeStart, timeEnd } = data;

    const client = await getSheetsClient();
    
    // Resolve residentId from email
    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === authEmail);
    if (!user) return json({ error: "Resident record not found" }, { status: 404 });
    const residentId = user[USER_COL.ID];

    // Basic Validation
    const startH = parseTime(timeStart);
    const endH = parseTime(timeEnd);
    if (isNaN(startH) || isNaN(endH) || startH >= endH) {
      return json({ error: "Invalid time range" }, { status: 400 });
    }

    // Overlap Check
    const resRows = await getSheetValues(client, PUBLIC_GS_SR_ID, "laundry!A:I");
    const isOverlapping = resRows.slice(1).some((r: any) => {
      if ((r[LAUNDRY_COL.STATUS] || "").trim() !== "ACTIVE" || (r[LAUNDRY_COL.DATE] || "").trim() !== date) return false;
      const rStart = parseTime(r[LAUNDRY_COL.TIME_START]);
      const rEnd = parseTime(r[LAUNDRY_COL.TIME_END]);
      return startH < rEnd && endH > rStart;
    });

    if (isOverlapping) {
      return json({ error: "This slot is already booked" }, { status: 409 });
    }

    const row = new Array(9).fill("");
    row[LAUNDRY_COL.ID] = crypto.randomUUID();
    row[LAUNDRY_COL.RESIDENT_ID] = residentId;
    row[LAUNDRY_COL.DATE] = date;
    row[LAUNDRY_COL.TIME_START] = formatTime(startH);
    row[LAUNDRY_COL.TIME_END] = formatTime(endH);
    row[LAUNDRY_COL.STATUS] = "ACTIVE";
    row[LAUNDRY_COL.CANCEL_REASON] = "";
    row[LAUNDRY_COL.CREATION_TIMESTAMP] = new Date().toISOString();
    row[LAUNDRY_COL.CANCEL_TIMESTAMP] = "";

    await appendSheetValue(client, PUBLIC_GS_SR_ID, "laundry!A:I", [row]);

    return json({ success: true, id: row[LAUNDRY_COL.ID] });
  } catch (e: any) {
    return serverError(e, "Laundry booking");
  }
};

/**
 * DELETE: Cancel a reservation
 */
export const DELETE: RequestHandler = async ({ url, request }) => {
  const { email: authEmail, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  const reservationId = url.searchParams.get("id");
  if (!reservationId) return json({ error: "Missing reservation ID" }, { status: 400 });

  try {
    const client = await getSheetsClient();
    
    // Resolve residentId
    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === authEmail);
    if (!user) return json({ error: "Resident record not found" }, { status: 404 });
    const residentId = user[USER_COL.ID];

    // Find row
    const resRows = await getSheetValues(client, PUBLIC_GS_SR_ID, "laundry!A:I");
    const rowIndex = resRows.findIndex((r: any) => (r[LAUNDRY_COL.ID] || "").trim() === reservationId);
    if (rowIndex === -1) return json({ error: "Reservation not found" }, { status: 404 });

    const targetRow = resRows[rowIndex];
    if (targetRow[LAUNDRY_COL.RESIDENT_ID] !== residentId) {
      return json({ error: "Unauthorized: You do not own this reservation" }, { status: 403 });
    }

    // Update row (F: Status, G: Cancel Reason, I: Cancel Timestamp)
    const actualRow = rowIndex + 1;
    const urlBase = `https://sheets.googleapis.com/v4/spreadsheets/${PUBLIC_GS_SR_ID}/values/laundry!F${actualRow}:I${actualRow}?valueInputOption=USER_ENTERED`;
    
    await fetch(urlBase, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${client}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [["CANCELLED_BY_USER", "Cancelled by user", "", new Date().toISOString()]]
      })
    });

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Laundry cancellation");
  }
};
