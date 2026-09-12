import {
  FRIDGE_ITEM_COL,
  FridgeCompartment,
  type FridgeItemRecord,
  FridgeItemStatus,
  type PaginatedResponse,
  type PaginationOptions
} from "$lib/types";
import { appendSheetRow, batchUpdateValues, fetchSheetRowsRaw } from "../common";
import type { FridgeServiceInterface } from "../interfaces/fridge-service.interface";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

export const sheetsFridgeService: FridgeServiceInterface = {
  async fetchFridgeItems(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache = false
  ): Promise<FridgeItemRecord[] | PaginatedResponse<FridgeItemRecord>> {
    const shouldRefresh = bypassCache || options?.bypassCache || false;
    if (auth.isResident) {
      const data = await fetchServer("/api/resident/fridge", {}, shouldRefresh);
      return Array.isArray(data) ? data : data.items || [];
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.sharedRecordsId,
      "fridge_items!A:M",
      shouldRefresh
    );
    let items: FridgeItemRecord[] = rows.slice(1).map((row) => ({
      id: (row[FRIDGE_ITEM_COL.ID] || "").trim(),
      residentId: (row[FRIDGE_ITEM_COL.RESIDENT_ID] || "").trim(),
      name: (row[FRIDGE_ITEM_COL.NAME] || "").trim(),
      compartment: (row[FRIDGE_ITEM_COL.COMPARTMENT] || FridgeCompartment.REFRIGERATOR).trim(),
      locationDetails: (row[FRIDGE_ITEM_COL.LOCATION_DETAILS] || "").trim(),
      dateStored: (row[FRIDGE_ITEM_COL.DATE_STORED] || "").trim(),
      expiryDate: (row[FRIDGE_ITEM_COL.EXPIRY_DATE] || "").trim(),
      photoUrl: (row[FRIDGE_ITEM_COL.PHOTO_URL] || "").trim(),
      status: (row[FRIDGE_ITEM_COL.STATUS] || FridgeItemStatus.STORED).trim(),
      notes: (row[FRIDGE_ITEM_COL.NOTES] || "").trim(),
      checkOutDate: (row[FRIDGE_ITEM_COL.CHECK_OUT_DATE] || "").trim(),
      tags: (row[FRIDGE_ITEM_COL.TAGS] || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      actionBy: (row[FRIDGE_ITEM_COL.ACTION_BY] || "").trim(),
      raw: row
    }));
    return items;
  },

  async addFridgeItem(data: Partial<FridgeItemRecord>): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const row = new Array(13).fill("");
    row[FRIDGE_ITEM_COL.ID] = data.id || crypto.randomUUID();
    row[FRIDGE_ITEM_COL.RESIDENT_ID] = data.residentId || "";
    row[FRIDGE_ITEM_COL.NAME] = data.name || "";
    row[FRIDGE_ITEM_COL.COMPARTMENT] = data.compartment || FridgeCompartment.REFRIGERATOR;
    row[FRIDGE_ITEM_COL.LOCATION_DETAILS] = data.locationDetails || "";
    row[FRIDGE_ITEM_COL.DATE_STORED] = data.dateStored || new Date().toISOString().split("T")[0];
    row[FRIDGE_ITEM_COL.EXPIRY_DATE] = data.expiryDate || "";
    row[FRIDGE_ITEM_COL.PHOTO_URL] = data.photoUrl || "";
    row[FRIDGE_ITEM_COL.STATUS] = data.status || FridgeItemStatus.STORED;
    row[FRIDGE_ITEM_COL.NOTES] = data.notes || "";
    row[FRIDGE_ITEM_COL.CHECK_OUT_DATE] = data.checkOutDate || "";
    row[FRIDGE_ITEM_COL.TAGS] = Array.isArray(data.tags) ? data.tags.join(",") : data.tags || "";
    row[FRIDGE_ITEM_COL.ACTION_BY] = data.actionBy || "";
    await appendSheetRow(uiSettings.sharedRecordsId, "fridge_items!A:M", [row]);
  },

  async updateFridgeItem(id: string, updates: Partial<FridgeItemRecord>): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/fridge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates })
      });
      return;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "fridge_items!A:M");
    const rowIndex = rows.findIndex((r) => (r[FRIDGE_ITEM_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Fridge item not found");
    }
    const actualRow = rowIndex + 1;
    const batch: { range: string; values: any[][] }[] = [];

    if (updates.name !== undefined) {
      batch.push({ range: `fridge_items!C${actualRow}`, values: [[updates.name]] });
    }
    if (updates.compartment !== undefined) {
      batch.push({ range: `fridge_items!D${actualRow}`, values: [[updates.compartment]] });
    }
    if (updates.locationDetails !== undefined) {
      batch.push({ range: `fridge_items!E${actualRow}`, values: [[updates.locationDetails]] });
    }
    if (updates.dateStored !== undefined) {
      batch.push({ range: `fridge_items!F${actualRow}`, values: [[updates.dateStored]] });
    }
    if (updates.expiryDate !== undefined) {
      batch.push({ range: `fridge_items!G${actualRow}`, values: [[updates.expiryDate]] });
    }
    if (updates.photoUrl !== undefined) {
      batch.push({ range: `fridge_items!H${actualRow}`, values: [[updates.photoUrl]] });
    }
    if (updates.status !== undefined) {
      batch.push({ range: `fridge_items!I${actualRow}`, values: [[updates.status]] });
    }
    if (updates.notes !== undefined) {
      batch.push({ range: `fridge_items!J${actualRow}`, values: [[updates.notes]] });
    }
    if (updates.checkOutDate !== undefined) {
      batch.push({ range: `fridge_items!K${actualRow}`, values: [[updates.checkOutDate]] });
    }
    if (updates.tags !== undefined) {
      const tagStr = Array.isArray(updates.tags) ? updates.tags.join(",") : updates.tags || "";
      batch.push({ range: `fridge_items!L${actualRow}`, values: [[tagStr]] });
    }
    if (updates.actionBy !== undefined) {
      batch.push({ range: `fridge_items!M${actualRow}`, values: [[updates.actionBy]] });
    }

    if (batch.length > 0) {
      await batchUpdateValues(uiSettings.sharedRecordsId, batch);
    }
  },

  async deleteFridgeItem(id: string, actionBy?: string): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/fridge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: FridgeItemStatus.DISCARDED, actionBy })
      });
      return;
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "fridge_items!A:M");
    const rowIndex = rows.findIndex((r) => (r[FRIDGE_ITEM_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Fridge item not found");
    }
    const actualRow = rowIndex + 1;
    const nowStr = new Date().toISOString();
    const photoUrl = (rows[rowIndex][FRIDGE_ITEM_COL.PHOTO_URL] || "").trim();
    if (photoUrl) {
      const match = photoUrl.match(/\/api\/image\/([a-zA-Z0-9_-]+)/);
      if (match) {
        try {
          await fetchServer(`/api/image/${match[1]}`, { method: "DELETE" });
        } catch (e) {
          console.warn("Failed to delete firestore image on admin discard:", e);
        }
      }
    }
    const batch: { range: string; values: any[][] }[] = [
      { range: `fridge_items!H${actualRow}`, values: [[""]] },
      { range: `fridge_items!I${actualRow}`, values: [[FridgeItemStatus.DISCARDED]] },
      { range: `fridge_items!K${actualRow}`, values: [[nowStr]] }
    ];
    if (actionBy) {
      batch.push({ range: `fridge_items!M${actualRow}`, values: [[actionBy]] });
    }
    await batchUpdateValues(uiSettings.sharedRecordsId, batch);
  }
};
