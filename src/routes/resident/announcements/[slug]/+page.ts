import { fetchAnnouncementBySlug } from "$api/controllers/announcement-controller";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  try {
    const announcement = await fetchAnnouncementBySlug(params.slug);
    return {
      announcement
    };
  } catch (e) {
    return {
      announcement: null,
      error: e instanceof Error ? e.message : String(e)
    };
  }
};
