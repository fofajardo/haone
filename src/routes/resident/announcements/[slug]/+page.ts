import type { PageLoad } from "./$types";
import { fetchAnnouncementBySlug } from "$logic/shared-records-logic";

export const load: PageLoad = async ({ params }) => {
  try {
    const announcement = await fetchAnnouncementBySlug(params.slug);
    return {
      announcement,
      pageInfo: {
        title: announcement.title
      }
    };
  } catch (e) {
    return {
      announcement: null,
      error: e instanceof Error ? e.message : String(e),
      pageInfo: {
        title: "Announcement"
      }
    };
  }
};
