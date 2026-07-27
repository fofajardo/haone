import { json } from "@sveltejs/kit";
import { ANNOUNCEMENT_COL, USER_COL } from "$lib/types";
import {
  authenticateResident,
  getSheetsClient,
  serverError,
  fetchSheetsData
} from "$lib/server/api-helper";
import { isAnnouncementActive } from "$api/controllers/announcement-controller";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  const url = new URL(request.url);
  const slugParam = url.searchParams.get("slug");

  try {
    const client = await getSheetsClient();
    const [rows, userRows] = await fetchSheetsData(client, ["announcements!A:L", "users!A:P"]);

    const userMap = new Map();
    userRows.slice(1).forEach((row: any) => {
      userMap.set((row[USER_COL.ID] || "").trim(), row[USER_COL.DISPLAY_NAME]);
    });

    const parsedAnnouncements = rows.slice(1).map((row: any) => {
      const creatorId = (row[ANNOUNCEMENT_COL.CREATOR_ID] || "").trim();
      return {
        id: (row[ANNOUNCEMENT_COL.ID] || "").trim(),
        creatorId,
        creatorName: userMap.get(creatorId) || "Administrator",
        dateCreated: (row[ANNOUNCEMENT_COL.DATE_CREATED] || "").trim(),
        startDate: (row[ANNOUNCEMENT_COL.START_DATE] || "").trim(),
        expiryDate: (row[ANNOUNCEMENT_COL.EXPIRY_DATE] || "").trim(),
        isIndefinite: (row[ANNOUNCEMENT_COL.IS_INDEFINITE] || "").toUpperCase() === "TRUE",
        isAdminOnly: (row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] || "").toUpperCase() === "TRUE",
        isUnlisted: (row[ANNOUNCEMENT_COL.IS_UNLISTED] || "").toUpperCase() === "TRUE",
        slug: (row[ANNOUNCEMENT_COL.SLUG] || "").trim(),
        tags: (row[ANNOUNCEMENT_COL.TAGS] || "").trim(),
        title: (row[ANNOUNCEMENT_COL.TITLE] || "").trim(),
        content: (row[ANNOUNCEMENT_COL.CONTENT] || "").trim()
      };
    });

    if (slugParam) {
      const found = parsedAnnouncements.find((a: any) => a.slug === slugParam);
      if (!found || found.isAdminOnly) {
        return json({ message: "not_found" }, { status: 404 });
      }
      if (!isAnnouncementActive(found)) {
        return json({ message: "expired" }, { status: 410 });
      }
      return json(found);
    }

    const announcements = parsedAnnouncements
      .filter((a: any) => {
        if (a.isAdminOnly) {
          return false;
        }
        if (a.isUnlisted) {
          return false;
        }
        return isAnnouncementActive(a);
      })
      .sort((a: any, b: any) => b.dateCreated.localeCompare(a.dateCreated));

    return json(announcements);
  } catch (e: any) {
    return serverError(e, "Announcements fetch");
  }
};
