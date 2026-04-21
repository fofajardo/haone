import { json } from "@sveltejs/kit";
import { PUBLIC_GS_RR_ID, PUBLIC_GS_AW_ID } from "$env/static/public";
import { CURR_COL } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  getSheetValues,
  appendSheetValue,
  serverError
} from "$lib/server/api-helper";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { email: authEmail, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const data = await request.json();
    const { email, firstName, lastName, studentNo, college, program, room, bed, checkInDate } =
      data;

    const targetEmail = (authEmail || email).toLowerCase();
    if (!targetEmail) return json({ error: "Missing email" }, { status: 400 });

    const client = await getSheetsClient();

    // Fetch Constants to get TERM_CURR
    const constRows = await getSheetValues(client, PUBLIC_GS_AW_ID, "constants!A:C");
    const activeTerm = constRows.find((r: any) => r[0] === "TERM_CURR")?.[1] || "";

    // Append to CURR sheet
    const newRow = new Array(12).fill("");
    newRow[CURR_COL.TIMESTAMP] = new Date().toISOString();
    newRow[CURR_COL.EMAIL] = targetEmail;
    newRow[CURR_COL.ROOM] = room;
    newRow[CURR_COL.BED] = bed;
    newRow[CURR_COL.LAST_NAME] = (lastName || "").trim().toUpperCase();
    newRow[CURR_COL.FIRST_NAME] = (firstName || "").trim().toUpperCase();
    newRow[CURR_COL.COLLEGE] = college;
    newRow[CURR_COL.PROGRAM] = program;
    newRow[CURR_COL.STUDENT_NO] = studentNo;
    newRow[CURR_COL.CHECK_IN_DATE] = checkInDate || "";
    newRow[CURR_COL.EVALUATED] = "FALSE";
    newRow[CURR_COL.TERM] = activeTerm;

    await appendSheetValue(client, PUBLIC_GS_RR_ID, "CURR!A:L", [newRow]);

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Registration");
  }
};
