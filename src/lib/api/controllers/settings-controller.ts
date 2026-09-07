import { settingsService } from "$api/services/settings-service";
import type { UserSettingsRecord } from "$lib/types";
import { fetchServer } from "$utils/api-client";

export async function fetchUserSettings(_bypassCache = false): Promise<UserSettingsRecord[]> {
  const { auth } = await import("$state/auth.svelte");
  const { residentState } = await import("$state/resident-state.svelte");
  const residentId = residentState.status?.profile?.id || "";
  if (!residentId) return [];

  const settings = await settingsService.fetchUserSettings(residentId);
  if (settings) {
    return [settings];
  }

  return [
    {
      residentId,
      isPublicAchievementList: true,
      residentNav: "home,finance,laundry",
      adminNav: "dashboard,history,residents",
      density: "default",
      typography: "default",
      theme: "system",
      isReducedMotion: false,
      clockFormat: "12h",
      raw: []
    }
  ];
}

export async function updateUserSettings(
  residentId: string,
  data: {
    isPublic?: boolean;
    residentNav?: string;
    adminNav?: string;
    density?: string;
    typography?: string;
    theme?: string;
    isReducedMotion?: boolean;
    clockFormat?: string;
  }
): Promise<any> {
  const payload: Partial<UserSettingsRecord> = {};
  if (data.isPublic !== undefined) {
    payload.isPublicAchievementList = data.isPublic;
  }
  if (data.residentNav !== undefined) {
    payload.residentNav = data.residentNav;
  }
  if (data.adminNav !== undefined) {
    payload.adminNav = data.adminNav;
  }
  if (data.density !== undefined) {
    payload.density = data.density;
  }
  if (data.typography !== undefined) {
    payload.typography = data.typography;
  }
  if (data.theme !== undefined) {
    payload.theme = data.theme;
  }
  if (data.isReducedMotion !== undefined) {
    payload.isReducedMotion = data.isReducedMotion;
  }
  if (data.clockFormat !== undefined) {
    payload.clockFormat = data.clockFormat;
  }

  return await settingsService.updateUserSettings(residentId, payload);
}

/**
 * Notifications Push Subscription
 */
export async function savePushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return await fetchServer("/api/resident/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth
    })
  });
}

export async function deletePushSubscription(endpoint: string) {
  return await fetchServer(
    `/api/resident/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
    {
      method: "DELETE"
    }
  );
}
