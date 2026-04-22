import { auth } from "./auth.svelte";
import { fetchServer } from "./utils";
import type {
  LaundryRecord,
  PaymentRequestRecord,
  AnnouncementRecord,
  AchievementRecord,
  AchievementLogRecord,
  UserSettingsRecord
} from "./schemas";

/**
 * Laundry Reservations
 */
export async function fetchLaundryReservations(
  forceRefresh = false
): Promise<LaundryRecord[] | { reservations: LaundryRecord[]; currentResidentId: string }> {
  const data = await fetchServer("/api/resident/laundry", {}, forceRefresh);
  return {
    reservations: data.reservations,
    currentResidentId: data.currentResidentId
  };
}

export async function addLaundryReservation(data: Omit<LaundryRecord, "raw">) {
  return await fetchServer("/api/resident/laundry", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function cancelLaundryReservation(
  reservationId: string,
  _reason: string,
  _status: any = null
) {
  return await fetchServer(`/api/resident/laundry?id=${reservationId}`, {
    method: "DELETE"
  });
}

/**
 * Self-service Payments
 */
export async function fetchPaymentRequests(
  forceRefresh = false
): Promise<
  PaymentRequestRecord[] | { requests: PaymentRequestRecord[]; currentResidentId: string }
> {
  const data = await fetchServer("/api/resident/payment-requests", {}, forceRefresh);
  return {
    requests: data.requests,
    currentResidentId: data.currentResidentId
  };
}

export async function addPaymentRequest(data: Omit<PaymentRequestRecord, "raw">) {
  return await fetchServer("/api/resident/payment-requests", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function cancelPaymentRequest(paymentId: string) {
  return await fetchServer(`/api/resident/payment-requests?id=${paymentId}`, {
    method: "DELETE"
  });
}

/**
 * Announcements
 */
export async function fetchAnnouncements(forceRefresh = false): Promise<AnnouncementRecord[]> {
  return await fetchServer("/api/resident/announcements", {}, forceRefresh);
}

/**
 * Achievements
 */
export async function fetchAchievements(forceRefresh = false): Promise<{
  achievements: AchievementRecord[];
  logs: AchievementLogRecord[];
  currentResidentId: string;
}> {
  const data = await fetchServer("/api/resident/achievements", {}, forceRefresh);
  return {
    achievements: data.achievements,
    logs: data.logs,
    currentResidentId: data.currentResidentId
  };
}

export async function fetchAchievementLogs(forceRefresh = false): Promise<{
  achievements: AchievementRecord[];
  logs: AchievementLogRecord[];
  currentResidentId: string;
}> {
  return await fetchAchievements(forceRefresh);
}

/**
 * User Settings
 */
export async function fetchUserSettings(forceRefresh = false): Promise<UserSettingsRecord[]> {
  const data = await fetchServer("/api/resident/settings", {}, forceRefresh);
  return [
    {
      residentId: auth.user?.email || "",
      isPublicAchievementList: data.isPublicAchievementList,
      residentNav: data.residentNav || "",
      adminNav: data.adminNav || "",
      density: data.density || "",
      typography: data.typography || "",
      theme: data.theme || "",
      isReducedMotion: data.isReducedMotion || false,
      raw: []
    }
  ];
}

export async function updateUserSettings(
  _residentId: string,
  data: {
    isPublic?: boolean;
    residentNav?: string;
    adminNav?: string;
    density?: string;
    typography?: string;
    theme?: string;
    isReducedMotion?: boolean;
  }
) {
  const payload: any = {};
  if (data.isPublic !== undefined) payload.isPublicAchievementList = data.isPublic;
  if (data.residentNav !== undefined) payload.residentNav = data.residentNav;
  if (data.adminNav !== undefined) payload.adminNav = data.adminNav;
  if (data.density !== undefined) payload.density = data.density;
  if (data.typography !== undefined) payload.typography = data.typography;
  if (data.theme !== undefined) payload.theme = data.theme;
  if (data.isReducedMotion !== undefined) payload.isReducedMotion = data.isReducedMotion;

  return await fetchServer("/api/resident/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
