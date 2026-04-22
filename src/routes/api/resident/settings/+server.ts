import { json } from "@sveltejs/kit";
import { PUBLIC_GS_SR_ID, PUBLIC_GS_RR_ID } from "$env/static/public";
import { USER_SETTINGS_COL, USER_COL } from "$lib/schemas";
import {
  authenticateResident,
  getSheetsClient,
  getSheetValues,
  appendSheetValue,
  serverError
} from "$lib/server/api-helper";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch settings for the authenticated resident
 */
export const GET: RequestHandler = async ({ request }) => {
  const { email: authEmail, error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();

    // Resolve residentId
    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === authEmail);
    if (!user) return json({ isPublicAchievementList: true });
    const residentId = user[USER_COL.ID];

    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "settings!A:D");
    const settings = rows.find(
      (r: any) => (r[USER_SETTINGS_COL.RESIDENT_ID] || "").trim() === residentId
    );

    return json({
      isPublicAchievementList: settings
        ? (settings[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "").toUpperCase() !== "FALSE"
        : true,
      residentNav: settings ? settings[USER_SETTINGS_COL.RESIDENT_NAV] || "" : "",
      adminNav: settings ? settings[USER_SETTINGS_COL.ADMIN_NAV] || "" : ""
    });
  } catch (e: any) {
    return serverError(e, "Settings fetch");
  }
};

/**
 * PATCH: Update resident settings
 */
export const PATCH: RequestHandler = async ({ request }) => {
  const { email: authEmail, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const data = await request.json();
    const { isPublicAchievementList, residentNav, adminNav } = data;

    const client = await getSheetsClient();

    // Resolve residentId
    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === authEmail);
    if (!user) return json({ error: "Resident record not found" }, { status: 404 });
    const residentId = user[USER_COL.ID];

    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "settings!A:D");
    const rowIndex = rows.findIndex(
      (r: any) => (r[USER_SETTINGS_COL.RESIDENT_ID] || "").trim() === residentId
    );

    const currentRecord = rowIndex !== -1 ? rows[rowIndex] : [];
    const isPublicVal =
      isPublicAchievementList !== undefined
        ? String(isPublicAchievementList).toUpperCase()
        : currentRecord[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "TRUE";
    const resNavVal =
      residentNav !== undefined ? residentNav : currentRecord[USER_SETTINGS_COL.RESIDENT_NAV] || "";
    const admNavVal =
      adminNav !== undefined ? adminNav : currentRecord[USER_SETTINGS_COL.ADMIN_NAV] || "";

    if (rowIndex === -1) {
      // Append new row
      await appendSheetValue(client, PUBLIC_GS_SR_ID, "settings!A:D", [
        [residentId, isPublicVal, resNavVal, admNavVal]
      ]);
    } else {
      // Update existing row
      const actualRow = rowIndex + 1;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${PUBLIC_GS_SR_ID}/values/settings!B${actualRow}:D${actualRow}?valueInputOption=USER_ENTERED`;

      await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${client}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [[isPublicVal, resNavVal, admNavVal]] })
      });
    }

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Settings update");
  }
};
