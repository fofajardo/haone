import { browser } from "$app/environment";
import { LS_KEYS } from "$lib/constants";

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
  given_name?: string;
}

class AuthState {
  accessToken = $state<string | null>(null);
  user = $state<UserInfo | null>(null);
  adminDisplayName = $state<string | null>(null);
  isRemembered = $state(false);
  lastError = $state<{ title: string; description: string } | null>(null);
  redirectTo = $state<string | null>(null);
  initialized = $state(false);
  cachedPicture = $state<string | null>(null);
  authType = $state<"admin" | "resident" | null>(null);
  isInstanceAdmin = $state(false);

  get displayName(): string {
    return this.adminDisplayName || this.user?.name || "";
  }

  get isResident(): boolean {
    if (this.authType === "resident") {
      return true;
    }
    if (browser && window.location.pathname.startsWith("/resident")) {
      return true;
    }
    if (this.authType !== "admin") {
      return true;
    }
    return false;
  }

  constructor() {
    if (browser) {
      const savedToken = localStorage.getItem(LS_KEYS.ACCESS_TOKEN);
      const savedUser = localStorage.getItem(LS_KEYS.USER);
      const remembered = localStorage.getItem(LS_KEYS.REMEMBER) === "true";

      if (remembered && savedToken && savedUser) {
        this.accessToken = savedToken;
        this.user = JSON.parse(savedUser);
        this.isRemembered = true;
        this.cachedPicture = localStorage.getItem(LS_KEYS.CACHED_PICTURE);
        this.authType = (localStorage.getItem("halsk.auth.type") as "admin" | "resident") || null;
        this.isInstanceAdmin = localStorage.getItem("halsk.auth.is_admin") === "true";
        const savedDisplayName = localStorage.getItem(LS_KEYS.DISPLAY_NAME);
        if (savedDisplayName) {
          this.adminDisplayName = savedDisplayName;
        }
      }
      this.initialized = true;
    }
  }

  setAdminDisplayName(name: string) {
    this.adminDisplayName = name;
    if (browser) {
      localStorage.setItem(LS_KEYS.DISPLAY_NAME, name);
    }
  }

  async ensureCachedPicture() {
    if (!this.user || !browser) {
      return;
    }

    // If we already have a cached picture in memory, skip
    if (this.cachedPicture) {
      return;
    }

    try {
      const response = await fetch(this.user.picture);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        this.cachedPicture = base64data;
        if (this.isRemembered) {
          localStorage.setItem(LS_KEYS.CACHED_PICTURE, base64data);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Failed to cache profile picture:", e);
    }
  }

  getHighResPictureUrl(url: string): string {
    if (!url) return url;
    // Google photo URLs standard pattern contains sizing parameters like =s96-c, =s64-c, /s96-c/, etc.
    // Replace size parameters with =s384-c for high-quality rendering (e.g., 384x384 px)
    return url.replace(/([=|\/])s\d+(-[c|p|o|g])?(\/|$)/, "$1s384-c$3");
  }

  setSession(
    token: string,
    user: UserInfo,
    remember: boolean,
    type: "admin" | "resident" = "admin",
    isInstanceAdmin: boolean = false
  ) {
    this.accessToken = token;

    // Normalize user photo URL to high resolution
    if (user.picture) {
      user.picture = this.getHighResPictureUrl(user.picture);
    }

    this.user = user;
    this.isRemembered = remember;
    this.authType = type;
    this.isInstanceAdmin = isInstanceAdmin;

    if (browser && remember) {
      localStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
      localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(LS_KEYS.REMEMBER, "true");
      localStorage.setItem("halsk.auth.type", type);
      localStorage.setItem("halsk.auth.is_admin", String(isInstanceAdmin));
      this.ensureCachedPicture();
    }
  }

  logout() {
    this.accessToken = null;
    this.user = null;
    this.adminDisplayName = null;
    this.isRemembered = false;

    if (browser) {
      import("$api/services/common").then(({ supabase }) => {
        if (supabase) {
          supabase.auth.signOut();
        }
      });
      localStorage.removeItem(LS_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(LS_KEYS.USER);
      localStorage.removeItem(LS_KEYS.REMEMBER);
      localStorage.removeItem(LS_KEYS.CACHED_PICTURE);
      localStorage.removeItem(LS_KEYS.DISPLAY_NAME);
      localStorage.removeItem("halsk.auth.type");
      localStorage.removeItem("halsk.auth.is_admin");
      this.cachedPicture = null;
      this.authType = null;
      this.isInstanceAdmin = false;
    }
  }

  async fetchUserInfo(token: string) {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      throw new Error("Failed to fetch user info");
    }
    const info = (await resp.json()) as UserInfo;
    if (info.picture) {
      info.picture = this.getHighResPictureUrl(info.picture);
    }
    return info;
  }
}

export const auth = new AuthState();
