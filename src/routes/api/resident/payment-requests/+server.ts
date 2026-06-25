import { json } from "@sveltejs/kit";
import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { PAYMENT_REQUEST_COL, PaymentRequestStatus } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  appendSheetValue,
  serverError,
  fetchSheetsData
} from "$lib/server/api-helper";
import { parseCSVAmount } from "$lib/receipt-utils";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch payment requests for the authenticated resident
 */
export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();

    const [rows] = await fetchSheetsData(client, ["payment_requests!A:L"]);

    const requests = rows
      .slice(1)
      .filter((r: any) => (r[PAYMENT_REQUEST_COL.RESIDENT_ID] || "").trim() === residentId)
      .map((row: any) => ({
        id: (row[PAYMENT_REQUEST_COL.ID] || "").trim(),
        residentId: (row[PAYMENT_REQUEST_COL.RESIDENT_ID] || "").trim(),
        date: (row[PAYMENT_REQUEST_COL.DATE] || "").trim(),
        waterFee: parseCSVAmount(row[PAYMENT_REQUEST_COL.WATER_FEE]),
        assocFee: parseCSVAmount(row[PAYMENT_REQUEST_COL.ASSOC_FEE]),
        misc: parseCSVAmount(row[PAYMENT_REQUEST_COL.MISC]),
        mop: (row[PAYMENT_REQUEST_COL.MOP] || "").trim(),
        type: (row[PAYMENT_REQUEST_COL.TYPE] || "").trim(),
        proofLink: (row[PAYMENT_REQUEST_COL.PROOF_LINK] || "").trim(),
        status: (row[PAYMENT_REQUEST_COL.STATUS] || PaymentRequestStatus.PENDING).trim(),
        notes: (row[PAYMENT_REQUEST_COL.NOTES] || "").trim(),
        statusReason: (row[PAYMENT_REQUEST_COL.STATUS_REASON] || "").trim()
      }))
      .reverse();

    return json({ requests, currentResidentId: residentId });
  } catch (e: any) {
    return serverError(e, "Payment requests fetch");
  }
};

/**
 * POST: Submit a new payment request
 */
export const POST: RequestHandler = async ({ request }) => {
  const { residentId, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const data = await request.json();
    const { date, waterFee, assocFee, misc, mop, type, proofLink, notes } = data;

    const client = await getSheetsClient();

    if (!residentId) return json({ error: "Resident record not found" }, { status: 404 });

    const row = new Array(12).fill("");
    row[PAYMENT_REQUEST_COL.ID] = crypto.randomUUID();
    row[PAYMENT_REQUEST_COL.RESIDENT_ID] = residentId;
    row[PAYMENT_REQUEST_COL.DATE] = date;
    row[PAYMENT_REQUEST_COL.WATER_FEE] = waterFee;
    row[PAYMENT_REQUEST_COL.ASSOC_FEE] = assocFee;
    row[PAYMENT_REQUEST_COL.MISC] = misc;
    row[PAYMENT_REQUEST_COL.MOP] = mop;
    row[PAYMENT_REQUEST_COL.TYPE] = type || "COLLECTION";
    row[PAYMENT_REQUEST_COL.PROOF_LINK] = proofLink;
    row[PAYMENT_REQUEST_COL.STATUS] = PaymentRequestStatus.PENDING;
    row[PAYMENT_REQUEST_COL.NOTES] = notes || "";
    row[PAYMENT_REQUEST_COL.STATUS_REASON] = "";

    await appendSheetValue(client, PUBLIC_GS_SR_ID, "payment_requests!A:L", [row]);

    return json({ success: true, id: row[PAYMENT_REQUEST_COL.ID] });
  } catch (e: any) {
    return serverError(e, "Payment request submission");
  }
};

/**
 * DELETE: Cancel a pending payment request
 */
export const DELETE: RequestHandler = async ({ url, request }) => {
  const { residentId, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  const requestId = url.searchParams.get("id");
  if (!requestId) return json({ error: "Missing request ID" }, { status: 400 });

  try {
    const client = await getSheetsClient();

    if (!residentId) return json({ error: "Resident record not found" }, { status: 404 });

    // Find row
    const [prRows] = await fetchSheetsData(client, ["payment_requests!A:L"]);
    const rowIndex = prRows.findIndex(
      (r: any) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === requestId
    );
    if (rowIndex === -1) return json({ error: "Payment request not found" }, { status: 404 });

    const targetRow = prRows[rowIndex];
    if (targetRow[PAYMENT_REQUEST_COL.RESIDENT_ID] !== residentId) {
      return json({ error: "Unauthorized: You do not own this request" }, { status: 403 });
    }

    if (targetRow[PAYMENT_REQUEST_COL.STATUS] !== PaymentRequestStatus.PENDING) {
      return json({ error: "Only pending requests can be cancelled" }, { status: 400 });
    }

    // Update row (J: Status)
    const actualRow = rowIndex + 1;
    const urlBase = `https://sheets.googleapis.com/v4/spreadsheets/${PUBLIC_GS_SR_ID}/values/payment_requests!J${actualRow}?valueInputOption=USER_ENTERED`;

    await fetch(urlBase, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${client}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [[PaymentRequestStatus.CANCELLED]]
      })
    });

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Payment request cancellation");
  }
};
