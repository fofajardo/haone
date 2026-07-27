import dayjs from "dayjs";
import { extractImageIds } from "$utils/image-utils";
import { type AnnouncementRecord, AnnouncementStatus } from "$lib/types";
import { announcementService } from "$api/services/announcement-service";

export function getAnnouncementStatus(a: AnnouncementRecord) {
  const now = dayjs();
  const start = a.startDate ? dayjs(a.startDate) : null;
  const expiry = a.expiryDate ? dayjs(a.expiryDate) : null;

  if (start && start.isAfter(now)) {
    return AnnouncementStatus.FUTURE;
  }
  if (a.isIndefinite) {
    return AnnouncementStatus.ACTIVE;
  }
  if (!expiry || expiry.isAfter(now) || expiry.isSame(now)) {
    return AnnouncementStatus.ACTIVE;
  }
  return AnnouncementStatus.EXPIRED;
}

export function isAnnouncementActive(a: AnnouncementRecord) {
  return getAnnouncementStatus(a) === AnnouncementStatus.ACTIVE;
}

export async function fetchAnnouncements(_forceRefresh = false): Promise<AnnouncementRecord[]> {
  const res = await announcementService.fetchAnnouncements();
  return Array.isArray(res) ? res : res.items;
}

export async function fetchAnnouncementBySlug(
  slug: string,
  _forceRefresh = false
): Promise<AnnouncementRecord> {
  const record = await announcementService.fetchAnnouncementBySlug(slug);
  if (!record) {
    throw new Error("Announcement not found");
  }
  return record;
}

export async function fetchAdminAnnouncements(
  _forceRefresh = false
): Promise<AnnouncementRecord[]> {
  const res = await announcementService.fetchAnnouncements();
  return Array.isArray(res) ? res : res.items;
}

export async function addAnnouncement(data: Omit<AnnouncementRecord, "raw">) {
  const all = await fetchAdminAnnouncements();
  if (all.some((a) => a.slug === data.slug)) {
    throw new Error(`Slug "${data.slug}" is already in use`);
  }
  await announcementService.addAnnouncement(data);
}

export async function updateAnnouncement(id: string, data: Partial<AnnouncementRecord>) {
  if (data.slug !== undefined) {
    const all = await fetchAdminAnnouncements();
    if (all.some((a) => a.slug === data.slug && a.id !== id)) {
      throw new Error(`Slug "${data.slug}" is already in use`);
    }
  }
  await announcementService.updateAnnouncement(id, data);
}

export async function expireAnnouncement(id: string) {
  await announcementService.expireAnnouncement(id);
}

export async function deleteAnnouncement(id: string, _accessToken?: string) {
  const all = await fetchAdminAnnouncements();
  const target = all.find((a) => a.id === id);
  if (target?.content) {
    extractImageIds(target.content);
  }
  await announcementService.deleteAnnouncement(id);
}
