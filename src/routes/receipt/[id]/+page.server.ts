import { error, fail } from "@sveltejs/kit";
import { PUBLIC_GS_AW_ID } from "$env/static/public";
import { JOURNAL_COL } from "$lib/types";
import type { PageServerLoad, Actions } from "./$types";
import type { ReceiptData, ReceiptItem } from "$lib/types";
import { getSheetsClient, getSheetValues } from "$lib/server/api-helper";
import { parseCSVAmount } from "$lib/utils/math";

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;

  return {
    pageInfo: { title: "Verification Required" },
    receiptData: null,
    id
  };
};

export const actions: Actions = {
  verify: async ({ request, params }) => {
    const formData = await request.formData();
    const stno = formData.get("stno")?.toString().trim();
    const id = params.id;

    if (!stno || !id) {
      return fail(400, { error: "Missing verification data" });
    }

    try {
      const client = await getSheetsClient();
      const jorRows = await getSheetValues(client, PUBLIC_GS_AW_ID, "journal_general!A:T");
      const row = jorRows.slice(1).find((r: any) => r[JOURNAL_COL.ID] === id);

      if (!row) {
        return fail(404, { error: "Transaction record not found" });
      }

      const correctStNo = (row[JOURNAL_COL.STNO] || "").toString().trim();
      if (stno === correctStNo) {
        // Build receipt data to return directly
        const prRefNo = row[JOURNAL_COL.PR_REFNO];
        const items: ReceiptItem[] = [];
        const water = parseCSVAmount(row[JOURNAL_COL.WATER]);
        const assoc = parseCSVAmount(row[JOURNAL_COL.ASSOC]);
        const misc = parseCSVAmount(row[JOURNAL_COL.MISC]);

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
          stno: row[JOURNAL_COL.STNO] || "",
          items
        };

        return { success: true, receiptData };
      }

      return fail(401, { error: "Student number does not match this record" });
    } catch (e: any) {
      console.error("Verification action failed:", e);
      return fail(500, { error: "Internal verification error" });
    }
  }
};
