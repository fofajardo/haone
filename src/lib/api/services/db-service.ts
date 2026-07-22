import {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow,
  deleteSheetRow,
  batchUpdateValues,
  invalidateCache
} from "$api/services/google-sheets-service";

/**
 * DB Facade Service
 * Entrypoint for database operations. Wraps current Google Sheets V4 implementation
 * and provides a standardized facade for future database providers (e.g. Supabase).
 */
export const dbService = {
  fetchRows: fetchSheetRowsRaw,
  updateValue: updateSheetValue,
  appendRow: appendSheetRow,
  deleteRow: deleteSheetRow,
  batchUpdate: batchUpdateValues,
  clearCache: invalidateCache
};

export {
  fetchSheetRowsRaw,
  updateSheetValue,
  appendSheetRow,
  deleteSheetRow,
  batchUpdateValues,
  invalidateCache
};
