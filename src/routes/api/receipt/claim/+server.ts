import { json } from "@sveltejs/kit";
import { JOURNAL_COL } from "$lib/schemas";
import type { RequestHandler } from "./$types";

import { getSheetsClient, fetchSheetsData } from "$lib/server/api-helper";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { pr_refno, stno } = await request.json();

    if (!pr_refno || !stno) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const token = await getSheetsClient();
    const [jorRows] = await fetchSheetsData(token, ["journal_general!A:T"]);

    const row = jorRows
      .slice(1)
      .find(
        (r: any) =>
          r[JOURNAL_COL.PR_REFNO] === pr_refno && (r[JOURNAL_COL.STNO] || "").trim() === stno.trim()
      );

    if (!row) {
      return json({ error: "Transaction not found or unauthorized" }, { status: 404 });
    }

    const secretId = row[JOURNAL_COL.ID];
    if (!secretId) {
      return json({ error: "Internal ID missing for this transaction" }, { status: 500 });
    }

    return json({ id: secretId });
  } catch (e: any) {
    console.error("Receipt claim failed:", e);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
