import { json } from "@sveltejs/kit";
import { PUBLIC_GS_RR_ID } from "$env/static/public";
import { CURR_COL } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
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

    // Append to CURR sheet
    const newRow = new Array(11).fill("");
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

    await appendSheetValue(client, PUBLIC_GS_RR_ID, "CURR!A:K", [newRow]);

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Registration");
  }
};
