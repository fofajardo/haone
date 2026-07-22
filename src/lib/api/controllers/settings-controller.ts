import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";
import type { UserSettingsRecord } from "$lib/types";

/**
 * User Settings (Proxy via server API)
 */
export async function fetchUserSettings(forceRefresh = false): Promise<UserSettingsRecord[]> {
  try {
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
        clockFormat: data.clockFormat || "12h",
        raw: []
      }
    ];
  } catch (e) {
    console.error("[SettingsController] Failed to fetch settings, returning defaults:", e);
    return [
      {
        residentId: auth.user?.email || "",
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
    clockFormat?: string;
  }
) {
  const payload: any = {};
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

  return await fetchServer("/api/resident/settings", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
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
