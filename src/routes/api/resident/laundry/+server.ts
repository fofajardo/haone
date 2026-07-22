import { json } from "@sveltejs/kit";
import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { LAUNDRY_COL, ACCOUNT_COL, USER_COL } from "$lib/types";
import {
  authenticateResident,
  getSheetsClient,
  appendSheetValue,
  serverError,
  fetchSheetsData,
  resolveResidentAccountType
} from "$lib/server/api-helper";
import { parseTime } from "$utils/parsers";
import { formatTime } from "$utils/formatters";
import { canAccessLaundry, canSeeLaundryNames } from "$api/controllers/resident-controller";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch all reservations + user room mapping
 */
export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();

    const [resRows, accRows, userRows, activeTerm] = await fetchSheetsData(client, [
      "laundry!A:I",
      "accounts!A:L",
      "users!A:P",
      "TERM_CURR"
    ]);

    const accountType = resolveResidentAccountType(accRows, activeTerm, residentId);

    if (!canAccessLaundry(accountType || "")) {
      return json({ error: "Access Denied: Account type cannot access laundry" }, { status: 403 });
    }

    const maskNames = !canSeeLaundryNames(accountType || "");

    const currentResidentId = residentId;

    // Build user map
    const userMap = new Map<string, any>();
    userRows.slice(1).forEach((u: any) => {
      const id = (u[USER_COL.ID] || "").trim();
      if (id) {
        userMap.set(id, {
          displayName: (u[USER_COL.DISPLAY_NAME] || "").trim()
        });
      }
    });

    // Resolve room map
    const roomMap = new Map<string, string>();
    accRows.slice(1).forEach((row: any) => {
      const rid = (row[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const room = (row[ACCOUNT_COL.ROOM] || "").trim();
      if (rid && room) {
        roomMap.set(rid, room);
      }
    });

    const reservations = resRows.slice(1).map((row: any) => {
      const resId = (row[LAUNDRY_COL.RESIDENT_ID] || "").trim();
      const isMine = resId === currentResidentId;
      const user = userMap.get(resId);
      const rawName = user?.displayName || "Resident";
      const rawRoom = roomMap.get(resId) || "";

      return {
        id: (row[LAUNDRY_COL.ID] || "").trim(),
        residentId: resId,
        date: (row[LAUNDRY_COL.DATE] || "").trim(),
        timeStart: (row[LAUNDRY_COL.TIME_START] || "").trim(),
        timeEnd: (row[LAUNDRY_COL.TIME_END] || "").trim(),
        status: (row[LAUNDRY_COL.STATUS] || "").trim(),
        cancelReason: (row[LAUNDRY_COL.CANCEL_REASON] || "").trim(),
        creationTimestamp: (row[LAUNDRY_COL.CREATION_TIMESTAMP] || "").trim(),
        cancelTimestamp: (row[LAUNDRY_COL.CANCEL_TIMESTAMP] || "").trim(),
        displayName: maskNames && !isMine ? "Reserved" : rawName,
        room: maskNames && !isMine ? "" : rawRoom
      };
    });

    return json({ reservations, currentResidentId });
  } catch (e: any) {
    return serverError(e, "Laundry fetch");
  }
};

/**
 * POST: Add a new reservation
 */
export const POST: RequestHandler = async ({ request }) => {
  const { residentId, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const data = await request.json();
    const { date, timeStart, timeEnd } = data;

    const client = await getSheetsClient();

    const [accRows, activeTerm, resRows] = await fetchSheetsData(client, [
      "accounts!A:L",
      "TERM_CURR",
      "laundry!A:I"
    ]);

    const accountType = resolveResidentAccountType(accRows, activeTerm, residentId);

    if (!canAccessLaundry(accountType || "")) {
      return json({ error: "Access Denied: Account type cannot access laundry" }, { status: 403 });
    }

    // Basic Validation
    const startH = parseTime(timeStart);
    const endH = parseTime(timeEnd);
    if (isNaN(startH) || isNaN(endH) || startH >= endH) {
      return json({ error: "Invalid time range" }, { status: 400 });
    }

    // Overlap Check
    const isOverlapping = resRows.slice(1).some((r: any) => {
      if (
        (r[LAUNDRY_COL.STATUS] || "").trim() !== "ACTIVE" ||
        (r[LAUNDRY_COL.DATE] || "").trim() !== date
      )
        return false;
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
  const { residentId, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  const reservationId = url.searchParams.get("id");
  if (!reservationId) return json({ error: "Missing reservation ID" }, { status: 400 });

  try {
    const client = await getSheetsClient();

    const [accRows, activeTerm, resRows] = await fetchSheetsData(client, [
      "accounts!A:L",
      "TERM_CURR",
      "laundry!A:I"
    ]);

    const accountType = resolveResidentAccountType(accRows, activeTerm, residentId);

    if (!canAccessLaundry(accountType || "")) {
      return json({ error: "Access Denied: Account type cannot access laundry" }, { status: 403 });
    }

    const rowIndex = resRows.findIndex(
      (r: any) => (r[LAUNDRY_COL.ID] || "").trim() === reservationId
    );
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
        values: [
          [
            "CANCELLED_BY_USER",
            "Cancelled by user",
            targetRow[LAUNDRY_COL.CREATION_TIMESTAMP] || "",
            new Date().toISOString()
          ]
        ]
      })
    });

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Laundry cancellation");
  }
};
