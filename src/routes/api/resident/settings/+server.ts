import { authenticateResident, getSheetsClient } from "$api/services/auth-service";
import { appendSheetValue, getSheetValues, serverError } from "$api/services/server-sheets-service";
import { PUBLIC_GS_RR_ID, PUBLIC_GS_SR_ID } from "$env/static/public";
import { USER_COL, USER_SETTINGS_COL } from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch settings for the authenticated resident
 */
export const GET: RequestHandler = async ({ request }) => {
  const { email: authEmail, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const client = await getSheetsClient();

    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === authEmail);

    if (!user) {
      console.warn(`[Settings] No user found for ${authEmail}. Returning defaults.`);
      return json({
        isPublicAchievementList: true,
        residentNav: "home,finance,laundry",
        adminNav: "dashboard,history,residents",
        density: "default",
        typography: "default",
        theme: "system",
        isReducedMotion: false,
        clockFormat: "12h"
      });
    }

    const residentId = (user[USER_COL.ID] || "").trim();
    if (!residentId) {
      console.error(`[Settings] User found for ${authEmail} but missing ID column.`);
      return json(
        { error: "malformed_user_record", message: "User record is missing an ID." },
        { status: 500 }
      );
    }

    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "settings!A:I");
    const settings = rows.find(
      (r: any) => (r[USER_SETTINGS_COL.RESIDENT_ID] || "").trim() === residentId
    );

    if (!settings) {
      console.log(`[Settings] No settings row for ${residentId}. Using defaults.`);
    }

    return json({
      isPublicAchievementList: settings
        ? (settings[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "").toUpperCase() !== "FALSE"
        : true,
      residentNav: settings
        ? settings[USER_SETTINGS_COL.RESIDENT_NAV] || "home,finance,laundry"
        : "home,finance,laundry",
      adminNav: settings
        ? settings[USER_SETTINGS_COL.ADMIN_NAV] || "dashboard,history,residents"
        : "dashboard,history,residents",
      density: settings ? settings[USER_SETTINGS_COL.DENSITY] || "default" : "default",
      typography: settings ? settings[USER_SETTINGS_COL.TYPOGRAPHY] || "default" : "default",
      theme: settings ? settings[USER_SETTINGS_COL.THEME] || "system" : "system",
      isReducedMotion: settings
        ? (settings[USER_SETTINGS_COL.IS_REDUCED_MOTION] || "").toUpperCase() === "TRUE"
        : false,
      clockFormat: settings ? settings[USER_SETTINGS_COL.CLOCK_FORMAT] || "12h" : "12h"
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
  if (authError) {
    return authError;
  }

  try {
    const data = await request.json();
    const {
      isPublicAchievementList,
      residentNav,
      adminNav,
      density,
      typography,
      theme,
      isReducedMotion,
      clockFormat
    } = data;

    const client = await getSheetsClient();

    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === authEmail);
    if (!user) {
      return json({ error: "Resident record not found" }, { status: 404 });
    }
    const residentId = user[USER_COL.ID];

    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "settings!A:I");
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

    const densityVal =
      density !== undefined ? density : currentRecord[USER_SETTINGS_COL.DENSITY] || "";
    const typographyVal =
      typography !== undefined ? typography : currentRecord[USER_SETTINGS_COL.TYPOGRAPHY] || "";
    const themeVal = theme !== undefined ? theme : currentRecord[USER_SETTINGS_COL.THEME] || "";
    const reducedMotionVal =
      isReducedMotion !== undefined
        ? String(isReducedMotion).toUpperCase()
        : currentRecord[USER_SETTINGS_COL.IS_REDUCED_MOTION] || "FALSE";
    const clockFormatVal =
      clockFormat !== undefined
        ? clockFormat
        : currentRecord[USER_SETTINGS_COL.CLOCK_FORMAT] || "24h";

    const finalValues = [
      isPublicVal,
      resNavVal,
      admNavVal,
      densityVal,
      typographyVal,
      themeVal,
      reducedMotionVal,
      clockFormatVal
    ];

    if (rowIndex === -1) {
      await appendSheetValue(client, PUBLIC_GS_SR_ID, "settings!A:I", [
        [residentId, ...finalValues]
      ]);
    } else {
      const actualRow = rowIndex + 1;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${PUBLIC_GS_SR_ID}/values/settings!B${actualRow}:I${actualRow}?valueInputOption=USER_ENTERED`;

      await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${client}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [finalValues] })
      });
    }

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Settings update");
  }
};
