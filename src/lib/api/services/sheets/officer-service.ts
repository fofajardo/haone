import type { OfficerServiceInterface } from "../interfaces/officer-service.interface";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow, deleteSheetRow } from "../common";
import { OFFICER_COL, type OfficerRecord, OfficerStatus } from "$lib/types";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

export const sheetsOfficerService: OfficerServiceInterface = {
  async fetchOfficers(bypassCache = false): Promise<OfficerRecord[]> {
    if (auth.isResident) {
      return fetchServer("/api/resident/officers", {}, bypassCache);
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.residentRecordsId,
      "directory!A:J",
      bypassCache
    );
    return rows
      .slice(1)
      .filter((row) => (row[OFFICER_COL.EMAIL] || "").trim() !== "")
      .map((row) => ({
        position: (row[OFFICER_COL.POSITION] || "").trim(),
        name: (row[OFFICER_COL.NAME] || "").trim(),
        nickname: (row[OFFICER_COL.NICKNAME] || "").trim(),
        email: (row[OFFICER_COL.EMAIL] || "").trim(),
        fbLink: (row[OFFICER_COL.FB_LINK] || "").trim(),
        term: (row[OFFICER_COL.TERM] || "").trim(),
        committee: (row[OFFICER_COL.COMMITTEE] || "").trim(),
        birthday: (row[OFFICER_COL.BIRTHDAY] || "").trim(),
        id: (row[OFFICER_COL.ID] || "").trim(),
        status: (row[OFFICER_COL.STATUS] || OfficerStatus.ACTIVE).trim(),
        raw: row
      }));
  },

  async addOfficer(data: Partial<OfficerRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    const row = new Array(10).fill("");
    row[OFFICER_COL.POSITION] = data.position || "";
    row[OFFICER_COL.NAME] = data.name || "";
    row[OFFICER_COL.NICKNAME] = data.nickname || "";
    row[OFFICER_COL.EMAIL] = data.email || "";
    row[OFFICER_COL.FB_LINK] = data.fbLink || "";
    row[OFFICER_COL.TERM] = data.term || "";
    row[OFFICER_COL.COMMITTEE] = data.committee || "";
    row[OFFICER_COL.BIRTHDAY] = data.birthday || "";
    row[OFFICER_COL.ID] = data.id || crypto.randomUUID();
    row[OFFICER_COL.STATUS] = data.status || OfficerStatus.ACTIVE;
    await appendSheetRow(uiSettings.residentRecordsId, "directory!A:J", [row]);
  },

  async updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "directory!A:J");
    const rowIndex = rows.findIndex((r) => (r[OFFICER_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Officer not found");
    }
    const actualRow = rowIndex + 1;
    const newRow = [...rows[rowIndex]];
    if (data.position !== undefined) {
      newRow[OFFICER_COL.POSITION] = data.position;
    }
    if (data.name !== undefined) {
      newRow[OFFICER_COL.NAME] = data.name;
    }
    if (data.nickname !== undefined) {
      newRow[OFFICER_COL.NICKNAME] = data.nickname;
    }
    if (data.email !== undefined) {
      newRow[OFFICER_COL.EMAIL] = data.email;
    }
    if (data.fbLink !== undefined) {
      newRow[OFFICER_COL.FB_LINK] = data.fbLink;
    }
    if (data.term !== undefined) {
      newRow[OFFICER_COL.TERM] = data.term;
    }
    if (data.committee !== undefined) {
      newRow[OFFICER_COL.COMMITTEE] = data.committee;
    }
    if (data.birthday !== undefined) {
      newRow[OFFICER_COL.BIRTHDAY] = data.birthday;
    }
    if (data.status !== undefined) {
      newRow[OFFICER_COL.STATUS] = data.status;
    }
    await updateSheetValue(uiSettings.residentRecordsId, `directory!A${actualRow}:J${actualRow}`, [
      newRow
    ]);
  },

  async deleteOfficer(id: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "directory!A:J");
    const rowIndex = rows.findIndex((r) => (r[OFFICER_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Officer not found");
    }
    await deleteSheetRow(uiSettings.residentRecordsId, "directory", rowIndex);
  }
};
