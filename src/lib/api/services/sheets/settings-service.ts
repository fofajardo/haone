import type { SettingsServiceInterface } from "../interfaces/settings-service.interface";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow } from "../common";
import { USER_SETTINGS_COL, type UserSettingsRecord } from "$lib/types";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

import { browser } from "$app/environment";

let _residentSettingsFetch: Promise<any> | null = null;

function fetchResidentSettings() {
  if (!_residentSettingsFetch) {
    _residentSettingsFetch = fetchServer("/api/resident/settings").finally(() => {
      _residentSettingsFetch = null;
    });
  }
  return _residentSettingsFetch;
}

export const sheetsSettingsService: SettingsServiceInterface = {
  async fetchUserSettings(residentId: string): Promise<UserSettingsRecord | null> {
    if (auth.isResident) {
      const data = await fetchResidentSettings();
      return { residentId, ...data, raw: [] };
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return null;
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "settings!A:I");
    const found = rows.find((r) => (r[USER_SETTINGS_COL.RESIDENT_ID] || "").trim() === residentId);
    if (!found) {
      return null;
    }
    return {
      residentId,
      isPublicAchievementList:
        (found[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "").toUpperCase() !== "FALSE",
      residentNav: found[USER_SETTINGS_COL.RESIDENT_NAV] || "home,finance,laundry",
      adminNav: found[USER_SETTINGS_COL.ADMIN_NAV] || "dashboard,history,residents",
      density: found[USER_SETTINGS_COL.DENSITY] || "default",
      typography: found[USER_SETTINGS_COL.TYPOGRAPHY] || "default",
      theme: found[USER_SETTINGS_COL.THEME] || "system",
      isReducedMotion: (found[USER_SETTINGS_COL.IS_REDUCED_MOTION] || "").toUpperCase() === "TRUE",
      clockFormat: found[USER_SETTINGS_COL.CLOCK_FORMAT] || "12h",
      raw: found
    };
  },

  async updateUserSettings(residentId: string, data: Partial<UserSettingsRecord>): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "settings!A:I");
    const rowIndex = rows.findIndex(
      (r) => (r[USER_SETTINGS_COL.RESIDENT_ID] || "").trim() === residentId
    );

    const currentRecord = rowIndex !== -1 ? rows[rowIndex] : [];
    const isPublicVal =
      data.isPublicAchievementList !== undefined
        ? String(data.isPublicAchievementList).toUpperCase()
        : currentRecord[USER_SETTINGS_COL.IS_PUBLIC_ACHIEVEMENT_LIST] || "TRUE";
    const resNavVal =
      data.residentNav !== undefined
        ? data.residentNav
        : currentRecord[USER_SETTINGS_COL.RESIDENT_NAV] || "";
    const admNavVal =
      data.adminNav !== undefined
        ? data.adminNav
        : currentRecord[USER_SETTINGS_COL.ADMIN_NAV] || "";
    const densityVal =
      data.density !== undefined ? data.density : currentRecord[USER_SETTINGS_COL.DENSITY] || "";
    const typographyVal =
      data.typography !== undefined
        ? data.typography
        : currentRecord[USER_SETTINGS_COL.TYPOGRAPHY] || "";
    const themeVal =
      data.theme !== undefined ? data.theme : currentRecord[USER_SETTINGS_COL.THEME] || "";
    const reducedMotionVal =
      data.isReducedMotion !== undefined
        ? String(data.isReducedMotion).toUpperCase()
        : currentRecord[USER_SETTINGS_COL.IS_REDUCED_MOTION] || "FALSE";
    const clockFormatVal =
      data.clockFormat !== undefined
        ? data.clockFormat
        : currentRecord[USER_SETTINGS_COL.CLOCK_FORMAT] || "12h";

    const finalValues = [
      residentId,
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
      await appendSheetRow(uiSettings.sharedRecordsId, "settings!A:I", [finalValues]);
    } else {
      const actualRow = rowIndex + 1;
      await updateSheetValue(uiSettings.sharedRecordsId, `settings!A${actualRow}:I${actualRow}`, [
        finalValues
      ]);
    }
  }
};
