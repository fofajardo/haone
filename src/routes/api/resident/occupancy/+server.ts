import { authenticateResident, getSheetsClient } from "$api/services/auth-service";
import { fetchSheetsData, serverError } from "$api/services/server-sheets-service";
import { ACCOUNT_COL, TRANSACTION_TYPE_CONFIG, TransactionType, USER_COL } from "$lib/types";
import { parseCSVAmount } from "$utils/math";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { email, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const client = await getSheetsClient();

    // 2. Fetch All Data
    const [accRows, userRows, journalRows, constRows] = await fetchSheetsData(client, [
      "accounts!A:L",
      "users!A:P",
      "journal_general!A:V",
      "constants!A:C"
    ]);

    const userRow = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === email);
    if (!userRow) {
      return json({ accounts: [] });
    }

    const userId = (userRow[USER_COL.ID] || "").trim();

    const getConstVal = (key: string) => constRows.find((r: any) => r[0] === key)?.[1] || "0";
    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;

    interface JournalEntry {
      period: string;
      water: number;
      assoc: number;
      misc: number;
      type: string;
    }

    // Filter journal for this resident
    const journal: JournalEntry[] = journalRows
      .slice(1)
      .filter((r: any) => {
        const acc = (r[2] || "").trim().toLowerCase();
        const accId = (r[21] || "").trim().toLowerCase();
        return (
          (userId && accId === userId.toLowerCase()) ||
          (userId && acc === userId.toLowerCase()) ||
          (email && acc === email)
        );
      })
      .map((r: any) => ({
        period: (r[7] || "").trim(),
        water: parseCSVAmount(r[3]),
        assoc: parseCSVAmount(r[4]),
        misc: parseCSVAmount(r[5]),
        type: (r[8] || "").trim()
      }));

    const accounts = accRows
      .slice(1)
      .filter((r: any) => r[ACCOUNT_COL.RESIDENT_ID] === userId)
      .map((r: any) => {
        const period = (r[ACCOUNT_COL.PERIOD] || "").trim();
        const waterBase = parseCSVAmount(getConstVal(`FEES_${period}_WATER`));
        const assocBase = parseCSVAmount(getConstVal(`FEES_${period}_ASSOC`));

        const filtered = journal.filter((j: JournalEntry) => j.period === period);
        const waterPaid = filtered
          .filter((j: JournalEntry) => j.type !== pmtWaived)
          .reduce((sum, j) => sum + j.water, 0);
        const waterWaived = filtered
          .filter((j: JournalEntry) => j.type === pmtWaived)
          .reduce((sum, j) => sum + j.water, 0);
        const assocPaid = filtered
          .filter((j: JournalEntry) => j.type !== pmtWaived)
          .reduce((sum, j) => sum + j.assoc, 0);
        const assocWaived = filtered
          .filter((j: JournalEntry) => j.type === pmtWaived)
          .reduce((sum, j) => sum + j.assoc, 0);

        const totalBase = waterBase + assocBase;
        const paid = waterPaid + assocPaid;
        const waived = waterWaived + assocWaived;
        const bal = totalBase - paid - waived;

        return {
          email: email,
          period,
          room: (r[ACCOUNT_COL.ROOM] || "").trim(),
          bed: (r[ACCOUNT_COL.BED] || "").trim(),
          checkInDate: (r[ACCOUNT_COL.CHECK_IN_DATE] || "").trim(),
          type: (r[ACCOUNT_COL.TYPE] || "").trim().toUpperCase(),
          ceRefNo: (r[ACCOUNT_COL.CE_REFNO] || "").trim(),
          ceIssued: (r[ACCOUNT_COL.CE_ISSUED] || "").trim(),
          ceLink: (r[ACCOUNT_COL.CE_LINK] || "").trim(),
          stno: (userRow[USER_COL.STUDENT_NO] || "").trim(),
          name: (userRow[USER_COL.DISPLAY_NAME] || "").trim(),
          ledgerId: (r[ACCOUNT_COL.ID] || "").trim(),
          totalBase,
          paid,
          waived,
          bal
        };
      })
      .sort((a: any, b: any) => b.period.localeCompare(a.period));

    return json({ accounts });
  } catch (e: any) {
    return serverError(e, "Occupancy fetch");
  }
};
