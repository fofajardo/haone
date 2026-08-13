import type { AnnouncementServiceInterface } from "../interfaces/announcement-service.interface";
import { fetchSheetRowsRaw, updateSheetValue, appendSheetRow, deleteSheetRow } from "../common";
import {
  ANNOUNCEMENT_COL,
  type AnnouncementRecord,
  type PaginationOptions,
  type PaginatedResponse
} from "$lib/types";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";
import dayjs from "dayjs";

export const sheetsAnnouncementService: AnnouncementServiceInterface = {
  async fetchAnnouncements(
    options?: PaginationOptions,
    activeOnly = false,
    forceRefresh = false
  ): Promise<AnnouncementRecord[] | PaginatedResponse<AnnouncementRecord>> {
    const shouldRefresh = forceRefresh || options?.forceRefresh || false;
    if (auth.isResident) {
      return fetchServer("/api/resident/announcements", {}, shouldRefresh);
    }

    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(
      uiSettings.sharedRecordsId,
      "announcements!A:M",
      shouldRefresh
    );
    const items = rows.slice(1).map((row) => ({
      id: (row[ANNOUNCEMENT_COL.ID] || "").trim(),
      creatorId: (row[ANNOUNCEMENT_COL.CREATOR_ID] || "").trim(),
      dateCreated: (row[ANNOUNCEMENT_COL.DATE_CREATED] || "").trim(),
      startDate: (row[ANNOUNCEMENT_COL.START_DATE] || "").trim(),
      expiryDate: (row[ANNOUNCEMENT_COL.EXPIRY_DATE] || "").trim(),
      isIndefinite: (row[ANNOUNCEMENT_COL.IS_INDEFINITE] || "").toUpperCase() === "TRUE",
      isAdminOnly: (row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] || "").toUpperCase() === "TRUE",
      isUnlisted: (row[ANNOUNCEMENT_COL.IS_UNLISTED] || "").toUpperCase() === "TRUE",
      slug: (row[ANNOUNCEMENT_COL.SLUG] || "").trim(),
      tags: (row[ANNOUNCEMENT_COL.TAGS] || "").trim(),
      title: (row[ANNOUNCEMENT_COL.TITLE] || "").trim(),
      content: (row[ANNOUNCEMENT_COL.CONTENT] || "").trim(),
      broadcastCount: parseInt(row[ANNOUNCEMENT_COL.BROADCAST_COUNT]) || 0,
      raw: row
    }));

    if (!activeOnly) {
      return items;
    }

    // Mirrors the active-window semantics of the announcement controller.
    return items.filter((a) => {
      if (a.isAdminOnly || a.isUnlisted) {
        return false;
      }
      const now = dayjs();
      const start = a.startDate ? dayjs(a.startDate) : null;
      const expiry = a.expiryDate ? dayjs(a.expiryDate) : null;
      if (start && start.isAfter(now)) {
        return false;
      }
      if (a.isIndefinite) {
        return true;
      }
      return !expiry || expiry.isAfter(now) || expiry.isSame(now);
    });
  },

  async fetchAnnouncementBySlug(
    slug: string,
    forceRefresh = false
  ): Promise<AnnouncementRecord | null> {
    if (auth.isResident) {
      try {
        return await fetchServer(
          `/api/resident/announcements?slug=${encodeURIComponent(slug)}`,
          {},
          forceRefresh
        );
      } catch (e) {
        return null;
      }
    }
    const res = await this.fetchAnnouncements(undefined, false, forceRefresh);
    const list = Array.isArray(res) ? res : res.items;
    return list.find((a) => a.slug === slug) || null;
  },

  async addAnnouncement(data: Partial<AnnouncementRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const row = new Array(13).fill("");
    row[ANNOUNCEMENT_COL.ID] = data.id || crypto.randomUUID();
    row[ANNOUNCEMENT_COL.CREATOR_ID] = data.creatorId || "";
    row[ANNOUNCEMENT_COL.DATE_CREATED] = data.dateCreated || new Date().toISOString();
    row[ANNOUNCEMENT_COL.START_DATE] = data.startDate || "";
    row[ANNOUNCEMENT_COL.EXPIRY_DATE] = data.expiryDate || "";
    row[ANNOUNCEMENT_COL.IS_INDEFINITE] = String(!!data.isIndefinite).toUpperCase();
    row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = String(!!data.isAdminOnly).toUpperCase();
    row[ANNOUNCEMENT_COL.IS_UNLISTED] = String(!!data.isUnlisted).toUpperCase();
    row[ANNOUNCEMENT_COL.SLUG] = data.slug || "";
    row[ANNOUNCEMENT_COL.TAGS] = data.tags || "";
    row[ANNOUNCEMENT_COL.TITLE] = data.title || "";
    row[ANNOUNCEMENT_COL.CONTENT] = data.content || "";
    row[ANNOUNCEMENT_COL.BROADCAST_COUNT] = "0";
    await appendSheetRow(uiSettings.sharedRecordsId, "announcements!A:M", [row]);
  },

  async updateAnnouncement(id: string, data: Partial<AnnouncementRecord>): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "announcements!A:M");
    const rowIndex = rows.findIndex((r) => (r[ANNOUNCEMENT_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Announcement not found");
    }
    const actualRow = rowIndex + 1;
    const newRow = [...rows[rowIndex]];
    if (data.startDate !== undefined) {
      newRow[ANNOUNCEMENT_COL.START_DATE] = data.startDate;
    }
    if (data.expiryDate !== undefined) {
      newRow[ANNOUNCEMENT_COL.EXPIRY_DATE] = data.expiryDate;
    }
    if (data.isIndefinite !== undefined) {
      newRow[ANNOUNCEMENT_COL.IS_INDEFINITE] = String(!!data.isIndefinite).toUpperCase();
    }
    if (data.isAdminOnly !== undefined) {
      newRow[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = String(!!data.isAdminOnly).toUpperCase();
    }
    if (data.isUnlisted !== undefined) {
      newRow[ANNOUNCEMENT_COL.IS_UNLISTED] = String(!!data.isUnlisted).toUpperCase();
    }
    if (data.slug !== undefined) {
      newRow[ANNOUNCEMENT_COL.SLUG] = data.slug;
    }
    if (data.tags !== undefined) {
      newRow[ANNOUNCEMENT_COL.TAGS] = data.tags;
    }
    if (data.title !== undefined) {
      newRow[ANNOUNCEMENT_COL.TITLE] = data.title;
    }
    if (data.content !== undefined) {
      newRow[ANNOUNCEMENT_COL.CONTENT] = data.content;
    }
    if (data.broadcastCount !== undefined) {
      newRow[ANNOUNCEMENT_COL.BROADCAST_COUNT] = String(data.broadcastCount);
    }
    await updateSheetValue(
      uiSettings.sharedRecordsId,
      `announcements!A${actualRow}:M${actualRow}`,
      [newRow]
    );
  },

  async expireAnnouncement(id: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    await this.updateAnnouncement(id, { expiryDate: today, isIndefinite: false });
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { uiSettings } = await import("$state/settings.svelte");
    if (!uiSettings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "announcements!A:M");
    const rowIndex = rows.findIndex((r) => (r[ANNOUNCEMENT_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Announcement not found");
    }
    await deleteSheetRow(uiSettings.sharedRecordsId, "announcements", rowIndex);
  }
};
