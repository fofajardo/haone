import type { AnnouncementRecord, PaginationOptions, PaginatedResponse } from "$lib/types";

export interface AnnouncementServiceInterface {
  fetchAnnouncements(
    options?: PaginationOptions,
    activeOnly?: boolean,
    forceRefresh?: boolean
  ): Promise<AnnouncementRecord[] | PaginatedResponse<AnnouncementRecord>>;

  fetchAnnouncementBySlug(slug: string, forceRefresh?: boolean): Promise<AnnouncementRecord | null>;

  addAnnouncement(data: Partial<AnnouncementRecord>): Promise<void>;

  updateAnnouncement(id: string, data: Partial<AnnouncementRecord>): Promise<void>;

  expireAnnouncement(id: string): Promise<void>;

  deleteAnnouncement(id: string): Promise<void>;
}
