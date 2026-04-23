import { json } from "@sveltejs/kit";
import { PUBLIC_GS_RR_ID, PUBLIC_GS_AW_ID } from "$env/static/public";
import { OFFICER_COL, USER_COL, ACCOUNT_COL } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  getSheetValues,
  serverError,
  fetchTermCurrServer
} from "$lib/server/api-helper";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();
    const [rows, currentTerm, userRows, accRows] = await Promise.all([
      getSheetValues(client, PUBLIC_GS_RR_ID, "directory!A:J"),
      fetchTermCurrServer(client),
      getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:Z"),
      getSheetValues(client, PUBLIC_GS_AW_ID, "accounts!A:Z")
    ]);

    const emailToUser = new Map();
    userRows.slice(1).forEach((r: any) => {
      const email = (r[USER_COL.EMAIL] || "").toLowerCase().trim();
      if (email) emailToUser.set(email, r);
    });

    const resLookupToRoom = new Map();
    accRows.slice(1).forEach((r: any) => {
      const resId = (r[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const term = (r[ACCOUNT_COL.PERIOD] || "").trim();
      if (resId && (term === currentTerm || !term)) {
        resLookupToRoom.set(resId, (r[ACCOUNT_COL.ROOM] || "").trim());
      }
    });

    const officers = rows
      .slice(1)
      .filter((row: any) => {
        const term = (row[OFFICER_COL.TERM] || "").trim();
        const status = (row[OFFICER_COL.STATUS] || "ACTIVE").trim();
        return term === currentTerm && status === "ACTIVE";
      })
      .map((row: any) => {
        const email = (row[OFFICER_COL.EMAIL] || "").toLowerCase().trim();
        const user = emailToUser.get(email);

        // Try to find room by ID first, then by Email
        let room = null;
        if (user) {
          room = resLookupToRoom.get(String(user[USER_COL.ID]).trim());
          if (!room) room = resLookupToRoom.get(email);
        } else {
          room = resLookupToRoom.get(email);
        }

        let committee = (row[OFFICER_COL.COMMITTEE] || "").trim();
        if (committee.toUpperCase() === "N/A" || committee === "None") committee = "";

        return {
          position: (row[OFFICER_COL.POSITION] || "").trim(),
          name: (row[OFFICER_COL.NAME] || "").trim(),
          nickname: (row[OFFICER_COL.NICKNAME] || "").trim(),
          committee,
          room: room || "N/A"
        };
      });

    return json(officers);
  } catch (e: any) {
    return serverError(e, "Officers fetch");
  }
};
