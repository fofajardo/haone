import type { PaymentRequestServiceInterface } from "../interfaces/payment-request-service.interface";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow } from "../common";
import {
  PAYMENT_REQUEST_COL,
  JOURNAL_COL,
  PaymentRequestStatus,
  type PaymentRequestRecord,
  type JournalRecord,
  type PaginationOptions,
  type PaginatedResponse
} from "$lib/types";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";
import { parseCSVAmount } from "$utils/math";
import { getLocalDateString } from "$utils/parsers";

export const sheetsPaymentRequestService: PaymentRequestServiceInterface = {
  async fetchPaymentRequests(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache = false
  ): Promise<PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord>> {
    const shouldRefresh = bypassCache || options?.bypassCache || false;
    if (auth.isResident) {
      const data = await fetchServer("/api/resident/payment-requests", {}, shouldRefresh);
      return Array.isArray(data) ? data : data.requests || [];
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.sharedRecordsId,
      "payment_requests!A:L",
      shouldRefresh
    );
    let items = rows.slice(1).map((row) => ({
      id: (row[PAYMENT_REQUEST_COL.ID] || "").trim(),
      residentId: (row[PAYMENT_REQUEST_COL.RESIDENT_ID] || "").trim(),
      date: (row[PAYMENT_REQUEST_COL.DATE] || "").trim(),
      waterFee: parseCSVAmount(row[PAYMENT_REQUEST_COL.WATER_FEE]),
      assocFee: parseCSVAmount(row[PAYMENT_REQUEST_COL.ASSOC_FEE]),
      misc: parseCSVAmount(row[PAYMENT_REQUEST_COL.MISC]),
      mop: (row[PAYMENT_REQUEST_COL.MOP] || "").trim(),
      type: (row[PAYMENT_REQUEST_COL.TYPE] || "").trim(),
      proofLink: (row[PAYMENT_REQUEST_COL.PROOF_LINK] || "").trim(),
      status: (row[PAYMENT_REQUEST_COL.STATUS] || PaymentRequestStatus.PENDING)
        .trim()
        .toUpperCase(),
      notes: (row[PAYMENT_REQUEST_COL.NOTES] || "").trim(),
      statusReason: (row[PAYMENT_REQUEST_COL.STATUS_REASON] || "").trim(),
      raw: row
    }));
    if (residentId) {
      items = items.filter((r) => r.residentId === residentId);
    }
    return items;
  },

  async addPaymentRequest(data: Partial<PaymentRequestRecord>): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return;
    }
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const row = new Array(12).fill("");
    row[PAYMENT_REQUEST_COL.ID] = data.id || crypto.randomUUID();
    row[PAYMENT_REQUEST_COL.RESIDENT_ID] = data.residentId || "";
    row[PAYMENT_REQUEST_COL.DATE] = data.date || getLocalDateString();
    row[PAYMENT_REQUEST_COL.WATER_FEE] = String(data.waterFee || 0);
    row[PAYMENT_REQUEST_COL.ASSOC_FEE] = String(data.assocFee || 0);
    row[PAYMENT_REQUEST_COL.MISC] = String(data.misc || 0);
    row[PAYMENT_REQUEST_COL.MOP] = data.mop || "";
    row[PAYMENT_REQUEST_COL.TYPE] = data.type || "";
    row[PAYMENT_REQUEST_COL.PROOF_LINK] = data.proofLink || "";
    row[PAYMENT_REQUEST_COL.STATUS] = data.status || PaymentRequestStatus.PENDING;
    row[PAYMENT_REQUEST_COL.NOTES] = data.notes || "";
    row[PAYMENT_REQUEST_COL.STATUS_REASON] = data.statusReason || "";
    await appendSheetRow(uiSettings.sharedRecordsId, "payment_requests!A:L", [row]);
  },

  async approvePaymentRequest(
    paymentId: string,
    journalData: Partial<JournalRecord>
  ): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    const srId = uiSettings.sharedRecordsId;
    const awId = uiSettings.accountingWorkbookId;
    if (!srId || !awId) {
      throw new Error("Spreadsheet IDs not configured");
    }

    const srRows = await fetchSheetRowsRaw(srId, "payment_requests!A:L");
    const rowIndex = srRows.findIndex(
      (r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === paymentId
    );
    if (rowIndex === -1) {
      throw new Error("Payment record not found");
    }

    const actualRow = rowIndex + 1;
    const jRow = new Array(22).fill("");
    jRow[JOURNAL_COL.DATE] = journalData.date || "";
    jRow[JOURNAL_COL.CREATOR] = "";
    jRow[JOURNAL_COL.ACCOUNT] = "";
    jRow[JOURNAL_COL.WATER] = journalData.water || 0;
    jRow[JOURNAL_COL.ASSOC] = journalData.assoc || 0;
    jRow[JOURNAL_COL.MISC] = journalData.misc || 0;
    jRow[JOURNAL_COL.MOP] = journalData.mop || "";
    jRow[JOURNAL_COL.PERIOD] = journalData.period || "";
    jRow[JOURNAL_COL.TYPE] = journalData.type || "";
    jRow[JOURNAL_COL.NOTES] = journalData.notes || "";
    jRow[JOURNAL_COL.NOTES_PRIVATE] = journalData.notesPrivate || "";
    jRow[JOURNAL_COL.MOP_REFNO] = journalData.mopRefNo || "";
    jRow[JOURNAL_COL.PR_DATE_ISSUED] = journalData.prDateIssued || "";
    jRow[JOURNAL_COL.PR_REFNO] = journalData.prRefNo || "";
    jRow[JOURNAL_COL.CREATOR_NAME] = "";
    jRow[JOURNAL_COL.NAME] = "";
    jRow[JOURNAL_COL.STNO] = "";
    jRow[JOURNAL_COL.WAS_AUDITED] = "FALSE";
    jRow[JOURNAL_COL.RECEIPT_URL] = journalData.receiptUrl || "";
    jRow[JOURNAL_COL.ID] = crypto.randomUUID();
    jRow[JOURNAL_COL.CREATOR_ID] = journalData.creatorId || "";
    jRow[JOURNAL_COL.ACCOUNT_ID] = journalData.accountId || "";

    await Promise.all([
      updateSheetValue(srId, `payment_requests!J${actualRow}`, [[PaymentRequestStatus.APPROVED]]),
      appendSheetRow(awId, "journal_general!A:V", [jRow])
    ]);
  },

  async declinePaymentRequest(paymentId: string, reason: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }

    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "payment_requests!A:L");
    const rowIndex = rows.findIndex((r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === paymentId);
    if (rowIndex === -1) {
      throw new Error("Payment record not found");
    }

    const actualRow = rowIndex + 1;
    await Promise.all([
      updateSheetValue(uiSettings.sharedRecordsId, `payment_requests!J${actualRow}`, [
        [PaymentRequestStatus.DECLINED]
      ]),
      updateSheetValue(uiSettings.sharedRecordsId, `payment_requests!L${actualRow}`, [[reason]])
    ]);
  },

  async cancelPaymentRequest(id: string): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/payment-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      return;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }

    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "payment_requests!A:L");
    const rowIndex = rows.findIndex((r) => (r[PAYMENT_REQUEST_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Payment request not found");
    }

    const actualRow = rowIndex + 1;
    await updateSheetValue(uiSettings.sharedRecordsId, `payment_requests!J${actualRow}`, [
      [PaymentRequestStatus.CANCELLED]
    ]);
  }
};
