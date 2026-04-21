import { json } from "@sveltejs/kit";
import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { ANNOUNCEMENT_COL } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  getSheetValues,
  serverError
} from "$lib/server/api-helper";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "announcements!A:J");

    const now = new Date().toISOString().split("T")[0];
    const announcements = rows
      .slice(1)
      .map((row: any) => ({
        id: (row[ANNOUNCEMENT_COL.ID] || "").trim(),
        creatorId: (row[ANNOUNCEMENT_COL.CREATOR_ID] || "").trim(),
        dateCreated: (row[ANNOUNCEMENT_COL.DATE_CREATED] || "").trim(),
        startDate: (row[ANNOUNCEMENT_COL.START_DATE] || "").trim(),
        expiryDate: (row[ANNOUNCEMENT_COL.EXPIRY_DATE] || "").trim(),
        isIndefinite: (row[ANNOUNCEMENT_COL.IS_INDEFINITE] || "").toUpperCase() === "TRUE",
        isAdminOnly: (row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] || "").toUpperCase() === "TRUE",
        tags: (row[ANNOUNCEMENT_COL.TAGS] || "").trim(),
        title: (row[ANNOUNCEMENT_COL.TITLE] || "").trim(),
        content: (row[ANNOUNCEMENT_COL.CONTENT] || "").trim()
      }))
      .filter((a: any) => {
        if (a.isAdminOnly) return false;
        if (a.startDate > now) return false;
        if (a.isIndefinite) return true;
        return a.expiryDate >= now;
      })
      .sort((a: any, b: any) => b.dateCreated.localeCompare(a.dateCreated));

    return json(announcements);
  } catch (e: any) {
    return serverError(e, "Announcements fetch");
  }
};
