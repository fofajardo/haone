import { uiSettings } from "$state/settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow,
  deleteSheetRow
} from "$api/services/google-sheets-service";
import { OFFICER_COL, type OfficerRecord, OfficerStatus } from "$lib/types";

export async function fetchOfficers(forceRefresh = false): Promise<OfficerRecord[]> {
  const spreadsheetId = uiSettings.residentRecordsId;
  if (!spreadsheetId) {
    return [];
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "directory!A:J", forceRefresh);
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
}

export async function addOfficer(
  data: Omit<OfficerRecord, "raw" | "id" | "status"> & {
    id?: string;
    status?: OfficerStatus | string;
  }
) {
  const spreadsheetId = uiSettings.residentRecordsId;
  if (!spreadsheetId) {
    throw new Error("Resident Records ID not configured");
  }

  const row = new Array(9).fill("");
  row[OFFICER_COL.POSITION] = data.position;
  row[OFFICER_COL.NAME] = data.name;
  row[OFFICER_COL.NICKNAME] = data.nickname;
  row[OFFICER_COL.EMAIL] = data.email;
  row[OFFICER_COL.FB_LINK] = data.fbLink;
  row[OFFICER_COL.TERM] = data.term;
  row[OFFICER_COL.COMMITTEE] = data.committee;
  row[OFFICER_COL.BIRTHDAY] = data.birthday;
  row[OFFICER_COL.ID] = data.id || crypto.randomUUID();
  row[OFFICER_COL.STATUS] = OfficerStatus.ACTIVE;

  await appendSheetRow(spreadsheetId, "directory!A:J", [row]);
}

export async function deleteOfficer(id: string) {
  const spreadsheetId = uiSettings.residentRecordsId;
  if (!spreadsheetId) {
    return;
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "directory!A:J", true);
  const rowIndex = rows.findIndex((r) => (r[OFFICER_COL.ID] || "").trim() === id);
  if (rowIndex === -1) {
    throw new Error("Officer not found");
  }

  await deleteSheetRow(spreadsheetId, "directory", rowIndex);
}

export async function updateOfficer(id: string, data: Partial<OfficerRecord>) {
  const spreadsheetId = uiSettings.residentRecordsId;
  if (!spreadsheetId) {
    throw new Error("Resident Records ID not configured");
  }

  const rows = await fetchSheetRowsRaw(spreadsheetId, "directory!A:J", true);
  const rowIndex = rows.findIndex((r) => (r[OFFICER_COL.ID] || "").trim() === id);
  if (rowIndex === -1) {
    throw new Error("Officer not found");
  }

  const actualRow = rowIndex + 1;
  const currentRow = rows[rowIndex];
  const newRow = [...currentRow];

  while (newRow.length < 10) {
    newRow.push("");
  }

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

  await updateSheetValue(spreadsheetId, `directory!A${actualRow}:J${actualRow}`, [newRow]);
}

export async function updateOfficerStatus(id: string, status: OfficerStatus) {
  await updateOfficer(id, { status });
}

export async function transitionOfficerPosition(id: string, newPosition: string) {
  const spreadsheetId = uiSettings.residentRecordsId;
  if (!spreadsheetId) {
    throw new Error("Resident Records ID not configured");
  }

  const officers = await fetchOfficers(true);
  const current = officers.find((o) => o.id === id);
  if (!current) {
    throw new Error("Officer not found");
  }

  await updateOfficer(id, { status: OfficerStatus.CHANGED_POSITION });

  await addOfficer({
    position: newPosition,
    name: current.name,
    nickname: current.nickname,
    email: current.email,
    fbLink: current.fbLink,
    term: current.term,
    committee: current.committee,
    birthday: current.birthday,
    status: OfficerStatus.ACTIVE
  });
}
