import { json } from "@sveltejs/kit";
import { PUBLIC_GS_SR_ID } from "$env/static/public";
import {
  FRIDGE_ITEM_COL,
  ACCOUNT_COL,
  USER_COL,
  FridgeItemStatus,
  FridgeCompartment
} from "$lib/types";
import {
  authenticateResident,
  getSheetsClient,
  appendSheetValue,
  updateSheetValue,
  serverError,
  fetchSheetsData
} from "$lib/server/api-helper";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch all fridge items + user/room mapping (Public to all logged-in residents)
 */
export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const client = await getSheetsClient();

    const [fridgeRows, accRows, userRows, activeTerm] = await fetchSheetsData(client, [
      "fridge_items!A:M",
      "accounts!A:L",
      "users!A:P",
      "TERM_CURR"
    ]);

    // Build user map
    const userMap = new Map();
    userRows.slice(1).forEach((r: any) => {
      userMap.set((r[USER_COL.ID] || "").trim(), r);
    });

    // Build room map
    const resIdToRoomMap = new Map();
    accRows.slice(1).forEach((r: any) => {
      const resId = (r[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const term = (r[ACCOUNT_COL.PERIOD] || "").trim();
      if (resId && (term === activeTerm || !term)) {
        const room = (r[ACCOUNT_COL.ROOM] || "").trim();
        if (room) {
          resIdToRoomMap.set(resId, room);
        }
      }
    });

    const items = fridgeRows.slice(1).map((row: any) => {
      const resId = (row[FRIDGE_ITEM_COL.RESIDENT_ID] || "").trim();
      const user = userMap.get(resId);
      let name = "Resident";
      if (user) {
        name = (user[USER_COL.DISPLAY_NAME] || "").trim();
      }
      const actionUser = userMap.get((row[FRIDGE_ITEM_COL.ACTION_BY] || "").trim());
      let actionName = (row[FRIDGE_ITEM_COL.ACTION_BY] || "").trim();
      if (actionUser) {
        actionName = (actionUser[USER_COL.DISPLAY_NAME] || "").trim();
      }

      return {
        id: (row[FRIDGE_ITEM_COL.ID] || "").trim(),
        residentId: resId == residentId ? resId : "ID_REDACTED",
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
          .map((t: string) => t.trim())
          .filter(Boolean),
        actionBy: actionName ? actionName : "",
        residentName: name,
        room: resIdToRoomMap.get(resId) || ""
      };
    });

    return json(items);
  } catch (err: any) {
    return serverError(err.message, "Fridge items fetch (Sheets)");
  }
};

/**
 * POST: Add new fridge item
 */
export const POST: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const data = await request.json();
    if (!data.name || !data.name.trim()) {
      return json({ error: "Item name is required" }, { status: 400 });
    }

    const client = await getSheetsClient();
    const id = data.id || crypto.randomUUID();
    const dateStored = data.dateStored || new Date().toISOString().split("T")[0];

    const row = new Array(13).fill("");
    row[FRIDGE_ITEM_COL.ID] = id;
    row[FRIDGE_ITEM_COL.RESIDENT_ID] = residentId;
    row[FRIDGE_ITEM_COL.NAME] = data.name.trim();
    row[FRIDGE_ITEM_COL.COMPARTMENT] = data.compartment || FridgeCompartment.REFRIGERATOR;
    row[FRIDGE_ITEM_COL.LOCATION_DETAILS] = (data.locationDetails || "").trim();
    row[FRIDGE_ITEM_COL.DATE_STORED] = dateStored;
    row[FRIDGE_ITEM_COL.EXPIRY_DATE] = (data.expiryDate || "").trim();
    row[FRIDGE_ITEM_COL.PHOTO_URL] = (data.photoUrl || "").trim();
    row[FRIDGE_ITEM_COL.STATUS] = FridgeItemStatus.STORED;
    row[FRIDGE_ITEM_COL.NOTES] = (data.notes || "").trim();
    row[FRIDGE_ITEM_COL.CHECK_OUT_DATE] = "";
    row[FRIDGE_ITEM_COL.TAGS] = Array.isArray(data.tags) ? data.tags.join(",") : data.tags || "";
    row[FRIDGE_ITEM_COL.ACTION_BY] = "";

    await appendSheetValue(client, PUBLIC_GS_SR_ID, "fridge_items!A:M", [row]);

    return json({ success: true, id });
  } catch (err: any) {
    return serverError(err.message, "Fridge item add (Sheets)");
  }
};

/**
 * PATCH: Update fridge item (Owner or Admin only)
 */
export const PATCH: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return json({ error: "Item ID is required" }, { status: 400 });
    }

    const client = await getSheetsClient();
    const [rows] = await fetchSheetsData(client, ["fridge_items!A:M"]);
    const rowIndex = rows.findIndex((r: any) => (r[FRIDGE_ITEM_COL.ID] || "").trim() === id);

    if (rowIndex === -1) {
      return json({ error: "Item not found" }, { status: 404 });
    }

    const itemResidentId = (rows[rowIndex][FRIDGE_ITEM_COL.RESIDENT_ID] || "").trim();
    if (itemResidentId !== residentId) {
      return json({ error: "Forbidden: You can only edit your own items" }, { status: 403 });
    }

    const actualRow = rowIndex + 1;
    const currentRow = rows[rowIndex];

    const updatedRow = [...currentRow];
    while (updatedRow.length < 13) {
      updatedRow.push("");
    }

    if (updates.name !== undefined) updatedRow[FRIDGE_ITEM_COL.NAME] = updates.name.trim();
    if (updates.compartment !== undefined)
      updatedRow[FRIDGE_ITEM_COL.COMPARTMENT] = updates.compartment;
    if (updates.locationDetails !== undefined)
      updatedRow[FRIDGE_ITEM_COL.LOCATION_DETAILS] = updates.locationDetails.trim();
    if (updates.dateStored !== undefined)
      updatedRow[FRIDGE_ITEM_COL.DATE_STORED] = updates.dateStored;
    if (updates.expiryDate !== undefined)
      updatedRow[FRIDGE_ITEM_COL.EXPIRY_DATE] = updates.expiryDate;
    if (updates.photoUrl !== undefined) updatedRow[FRIDGE_ITEM_COL.PHOTO_URL] = updates.photoUrl;
    if (updates.status !== undefined) updatedRow[FRIDGE_ITEM_COL.STATUS] = updates.status;
    if (updates.notes !== undefined) updatedRow[FRIDGE_ITEM_COL.NOTES] = updates.notes.trim();
    if (updates.checkOutDate !== undefined)
      updatedRow[FRIDGE_ITEM_COL.CHECK_OUT_DATE] = updates.checkOutDate;
    if (updates.tags !== undefined) {
      updatedRow[FRIDGE_ITEM_COL.TAGS] = Array.isArray(updates.tags)
        ? updates.tags.join(",")
        : updates.tags || "";
    }
    if (updates.actionBy !== undefined) updatedRow[FRIDGE_ITEM_COL.ACTION_BY] = updates.actionBy;

    await updateSheetValue(
      client,
      PUBLIC_GS_SR_ID,
      `fridge_items!A${actualRow}:M${actualRow}`,
      [updatedRow]
    );

    return json({ success: true });
  } catch (err: any) {
    return serverError(err.message, "Fridge item update (Sheets)");
  }
};

/**
 * DELETE / Take Out: Quick removal / discard of item
 */
export const DELETE: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const { id, status: newStatus } = await request.json();
    if (!id) {
      return json({ error: "Item ID is required" }, { status: 400 });
    }

    const client = await getSheetsClient();
    const [rows] = await fetchSheetsData(client, ["fridge_items!A:M"]);
    const rowIndex = rows.findIndex((r: any) => (r[FRIDGE_ITEM_COL.ID] || "").trim() === id);

    if (rowIndex === -1) {
      return json({ error: "Item not found" }, { status: 404 });
    }

    const itemResidentId = (rows[rowIndex][FRIDGE_ITEM_COL.RESIDENT_ID] || "").trim();
    if (itemResidentId !== residentId) {
      return json({ error: "Forbidden: You can only modify your own items" }, { status: 403 });
    }

    const actualRow = rowIndex + 1;
    const nowStr = new Date().toISOString();
    const targetStatus = newStatus || FridgeItemStatus.CHECKED_OUT;
    const actorId = residentId;

    // If discarding and item had a photo, delete from Firestore
    const photoUrl = (rows[rowIndex][FRIDGE_ITEM_COL.PHOTO_URL] || "").trim();
    if (targetStatus === FridgeItemStatus.DISCARDED && photoUrl) {
      const match = photoUrl.match(/\/api\/image\/([a-zA-Z0-9_-]+)/);
      if (match) {
        try {
          const { deleteImageFromFirestore } = await import("$api/services/firestore-service");
          await deleteImageFromFirestore(match[1]);
        } catch (e) {
          console.warn("Failed to delete firestore image on discard:", e);
        }
      }
    }

    const newPhotoUrl = targetStatus === FridgeItemStatus.DISCARDED ? "" : photoUrl;

    await updateSheetValue(
      client,
      PUBLIC_GS_SR_ID,
      `fridge_items!H${actualRow}:M${actualRow}`,
      [
        [
          newPhotoUrl,
          targetStatus,
          rows[rowIndex][FRIDGE_ITEM_COL.NOTES] || "",
          nowStr,
          rows[rowIndex][FRIDGE_ITEM_COL.TAGS] || "",
          actorId
        ]
      ]
    );

    return json({ success: true });
  } catch (err: any) {
    return serverError(err.message, "Fridge item delete (Sheets)");
  }
};
