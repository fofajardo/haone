import { error } from "@sveltejs/kit";
import { PUBLIC_GS_AW_ID } from "$env/static/public";
import type { JWT } from "google-auth-library";
import { JOURNAL_COL } from "$lib/schemas";
import type { PageServerLoad } from "./$types";
import type { ReceiptData, ReceiptItem } from "$lib/types";

import { getSheetsClient, getSheetValues } from "$lib/server/api-helper";

export const load: PageServerLoad = async ({ url }) => {
  const id = url.searchParams.get("id");

  if (!id) {
    return {
      pageInfo: { title: "Acknowledgment Receipt" },
      receiptData: null
    };
  }

  try {
    const client = await getSheetsClient();
    const jorRows = await getSheetValues(client, PUBLIC_GS_AW_ID, "journal_general!A:T");
    const row = jorRows.slice(1).find((r: any) => r[JOURNAL_COL.ID] === id);

    if (!row) {
      throw error(404, "Transaction not found or unauthorized access.");
    }

    const prRefNo = row[JOURNAL_COL.PR_REFNO];
    if (!prRefNo || prRefNo === "#N/A" || prRefNo === "N/A" || prRefNo === "") {
      throw error(
        403,
        "This transaction has not been evaluated yet. No receipt is available at this time."
      );
    }

    const parseAmount = (val: any) => {
      if (!val) return 0;
      const cleaned = String(val).replace(/[₱,\s]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const items: ReceiptItem[] = [];
    const water = parseAmount(row[JOURNAL_COL.WATER]);
    const assoc = parseAmount(row[JOURNAL_COL.ASSOC]);
    const misc = parseAmount(row[JOURNAL_COL.MISC]);

    if (water !== 0) items.push({ name: "Water Fee", amount: water });
    if (assoc !== 0) items.push({ name: "Association Fee", amount: assoc });
    if (misc !== 0) items.push({ name: "Miscellaneous", amount: misc });

    const receiptData: ReceiptData = {
      dateIssued: row[JOURNAL_COL.PR_DATE_ISSUED] || new Date().toISOString().split("T")[0],
      paymentDate: row[JOURNAL_COL.DATE],
      processor: row[JOURNAL_COL.MOP],
      referenceNumber: row[JOURNAL_COL.MOP_REFNO] || "N/A",
      period: row[JOURNAL_COL.PERIOD],
      seriesNumber: prRefNo,
      receivedFrom: row[JOURNAL_COL.NAME] || "N/A",
      receivedBy: row[JOURNAL_COL.CREATOR_NAME] || "N/A",
      notes: row[JOURNAL_COL.NOTES],
      transactionType: row[JOURNAL_COL.TYPE],
      branding: "default",
      items
    };

    return {
      pageInfo: { title: "Acknowledgment Receipt" },
      receiptData
    };
  } catch (e: any) {
    if (e.status) throw e;
    console.error("Receipt load failed:", e);
    throw error(500, "Failed to load receipt details.");
  }
};
