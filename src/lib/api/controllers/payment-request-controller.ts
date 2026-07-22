import { uiSettings } from "$state/settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow
} from "$api/services/google-sheets-service";
import { fetchServer } from "$utils/api-client";
import {
  PAYMENT_REQUEST_COL,
  JOURNAL_COL,
  type PaymentRequestRecord,
  PaymentRequestStatus
} from "$lib/types";

function parseAmount(val: any): number {
  if (!val) {
    return 0;
  }
  const clean = String(val).replace(/[^0-9.-]+/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Resident API Methods (Proxy via server API)
 */
export async function fetchPaymentRequests(
  forceRefresh = false
): Promise<
  PaymentRequestRecord[] | { requests: PaymentRequestRecord[]; currentResidentId: string }
> {
  const data = await fetchServer("/api/resident/payment-requests", {}, forceRefresh);
  return {
    requests: data.requests,
    currentResidentId: data.currentResidentId
  };
}

export async function addPaymentRequest(data: Omit<PaymentRequestRecord, "raw">) {
  return await fetchServer("/api/resident/payment-requests", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function cancelPaymentRequest(paymentId: string) {
  return await fetchServer(`/api/resident/payment-requests?id=${paymentId}`, {
    method: "DELETE"
  });
}

/**
 * Admin Direct Methods (Direct Google Sheets API)
 */
export async function fetchAdminPaymentRequests(
  forceRefresh = false
): Promise<PaymentRequestRecord[]> {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    return [];
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:L", forceRefresh);
  return rows.slice(1).map((row) => ({
    id: (row[PAYMENT_REQUEST_COL.ID] || "").trim(),
    residentId: (row[PAYMENT_REQUEST_COL.RESIDENT_ID] || "").trim(),
    date: (row[PAYMENT_REQUEST_COL.DATE] || "").trim(),
    waterFee: parseAmount(row[PAYMENT_REQUEST_COL.WATER_FEE]),
    assocFee: parseAmount(row[PAYMENT_REQUEST_COL.ASSOC_FEE]),
    misc: parseAmount(row[PAYMENT_REQUEST_COL.MISC]),
    mop: (row[PAYMENT_REQUEST_COL.MOP] || "").trim(),
    type: (row[PAYMENT_REQUEST_COL.TYPE] || "").trim(),
    proofLink: (row[PAYMENT_REQUEST_COL.PROOF_LINK] || "").trim(),
    status: (row[PAYMENT_REQUEST_COL.STATUS] || PaymentRequestStatus.PENDING).trim().toUpperCase(),
    notes: (row[PAYMENT_REQUEST_COL.NOTES] || "").trim(),
    statusReason: (row[PAYMENT_REQUEST_COL.STATUS_REASON] || "").trim(),
    raw: row
  }));
}

export async function approvePaymentRequest(
  paymentId: string,
  journalData: {
    date: string;
    creator: string;
    account: string;
    water: number;
    assoc: number;
    misc: number;
    mop: string;
    period: string;
    type: string;
    notes: string;
    mopRefNo: string;
    creatorName: string;
    name: string;
    stno: string;
    receiptUrl?: string;
  }
) {
  const srId = uiSettings.sharedRecordsId;
  const awId = uiSettings.accountingWorkbookId;
  if (!srId || !awId) {
    throw new Error("Spreadsheet IDs not configured");
  }

  const srRows = await fetchSheetRowsRaw(srId, "payment_requests!A:L");
  const rowIndex = srRows.findIndex((r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === paymentId);
  if (rowIndex === -1) {
    throw new Error("Payment record not found");
  }

  const actualRow = rowIndex + 1;
  const jRow = new Array(20).fill("");
  jRow[JOURNAL_COL.DATE] = journalData.date;
  jRow[JOURNAL_COL.CREATOR] = journalData.creator;
  jRow[JOURNAL_COL.ACCOUNT] = journalData.account;
  jRow[JOURNAL_COL.WATER] = journalData.water;
  jRow[JOURNAL_COL.ASSOC] = journalData.assoc;
  jRow[JOURNAL_COL.MISC] = journalData.misc;
  jRow[JOURNAL_COL.MOP] = journalData.mop;
  jRow[JOURNAL_COL.PERIOD] = journalData.period;
  jRow[JOURNAL_COL.TYPE] = journalData.type;
  jRow[JOURNAL_COL.NOTES] = journalData.notes;
  jRow[JOURNAL_COL.MOP_REFNO] = journalData.mopRefNo;
  jRow[JOURNAL_COL.CREATOR_NAME] = journalData.creatorName;
  jRow[JOURNAL_COL.NAME] = journalData.name;
  jRow[JOURNAL_COL.STNO] = journalData.stno;
  jRow[JOURNAL_COL.WAS_AUDITED] = "FALSE";
  jRow[JOURNAL_COL.RECEIPT_URL] = journalData.receiptUrl || "";
  jRow[JOURNAL_COL.ID] = crypto.randomUUID();

  await Promise.all([
    updateSheetValue(srId, `payment_requests!J${actualRow}`, [[PaymentRequestStatus.APPROVED]]),
    appendSheetRow(awId, "journal_general!A:T", [jRow])
  ]);
}

export async function declinePaymentRequest(paymentId: string, reason: string) {
  const spreadsheetId = uiSettings.sharedRecordsId;
  if (!spreadsheetId) {
    throw new Error("Shared Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:L");
  const rowIndex = rows.findIndex((r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === paymentId);
  if (rowIndex === -1) {
    throw new Error("Payment record not found");
  }

  const actualRow = rowIndex + 1;
  await Promise.all([
    updateSheetValue(spreadsheetId, `payment_requests!J${actualRow}`, [
      [PaymentRequestStatus.DECLINED]
    ]),
    updateSheetValue(spreadsheetId, `payment_requests!L${actualRow}`, [[reason]])
  ]);
}
