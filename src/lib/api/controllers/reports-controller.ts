import {
  createNewSpreadsheet,
  ensureSheetExists,
  formatReportSheet,
  updateSheetValue
} from "$api/services/common";

export async function exportReportToSheet(
  targetId: string,
  sheetName: string,
  headers: string[],
  rows: any[][]
): Promise<void> {
  await updateSheetValue(targetId, `${sheetName}!A1`, [headers, ...rows]);
  await formatReportSheet(targetId, sheetName, rows.length + 1, headers.length);
}

export { createNewSpreadsheet, ensureSheetExists };
