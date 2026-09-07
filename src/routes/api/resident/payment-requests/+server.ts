import { PUBLIC_GS_SR_ID } from "$env/static/public";
import {
  appendSheetValue,
  authenticateResident,
  fetchSheetsData,
  getSheetsClient,
  serverError
} from "$lib/server/api-helper";
import { PAYMENT_REQUEST_COL, PaymentRequestStatus } from "$lib/types";
import { parseCSVAmount } from "$utils/math";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch payment requests for the authenticated resident
 */
export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

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
      }));

    return json({ requests, currentResidentId: residentId });
  } catch (e: any) {
    return serverError(e, "Payment requests fetch");
  }
};

/**
 * POST: Submit a new payment request
 */
export const POST: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const { waterFee, assocFee, misc, mop, type, proofLink, notes } = body;

    const parsedWater = parseCSVAmount(waterFee);
    const parsedAssoc = parseCSVAmount(assocFee);
    const parsedMisc = parseCSVAmount(misc);

    if (parsedWater < 0 || parsedAssoc < 0 || parsedMisc < 0) {
      return json({ error: "Amounts cannot be negative" }, { status: 400 });
    }

    if (parsedWater + parsedAssoc + parsedMisc <= 0) {
      return json({ error: "Total amount must be greater than 0" }, { status: 400 });
    }

    if (!mop || !type || !proofLink) {
      return json(
        { error: "Mode of Payment, Fee Type, and Proof of Payment link are required" },
        { status: 400 }
      );
    }

    const client = await getSheetsClient();
    const id = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];

    const row = [
      id,
      residentId,
      today,
      parsedWater,
      parsedAssoc,
      parsedMisc,
      mop,
      type,
      proofLink,
      PaymentRequestStatus.PENDING,
      notes || "",
      ""
    ];

    await appendSheetValue(client, PUBLIC_GS_SR_ID, "payment_requests!A:L", [row]);

    return json({ success: true, id });
  } catch (e: any) {
    return serverError(e, "Payment request creation");
  }
};

/**
 * DELETE: Cancel a pending payment request
 */
export const DELETE: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  let id = "";
  try {
    const body = await request.json();
    id = (body?.id || "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!id) {
    return json({ error: "Payment Request ID is required" }, { status: 400 });
  }

  try {
    const client = await getSheetsClient();
    const [rows] = await fetchSheetsData(client, ["payment_requests!A:L"]);

    const rowIndex = rows
      .slice(1)
      .findIndex(
        (r: any) =>
          (r[PAYMENT_REQUEST_COL.ID] || "").trim() === id &&
          (r[PAYMENT_REQUEST_COL.RESIDENT_ID] || "").trim() === residentId
      );

    if (rowIndex === -1) {
      return json({ error: "Payment request not found or unauthorized" }, { status: 404 });
    }

    const currentStatus = (
      rows[rowIndex + 1][PAYMENT_REQUEST_COL.STATUS] || PaymentRequestStatus.PENDING
    ).trim();

    if (currentStatus !== PaymentRequestStatus.PENDING) {
      return json({ error: `Cannot cancel request in ${currentStatus} status` }, { status: 400 });
    }

    const actualRow = rowIndex + 2;
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${PUBLIC_GS_SR_ID}/values/payment_requests!J${actualRow}:L${actualRow}?valueInputOption=USER_ENTERED`;

    await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${client}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [
          [
            PaymentRequestStatus.CANCELLED,
            rows[rowIndex + 1][PAYMENT_REQUEST_COL.NOTES] || "",
            "Cancelled by resident"
          ]
        ]
      })
    });

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Payment request cancellation");
  }
};
