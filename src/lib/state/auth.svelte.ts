import { authService } from "$api/services/auth-service";
import { browser } from "$app/environment";
import { LS_KEYS } from "$lib/constants";
import type { GoogleUserInfo } from "$lib/types";

class AuthState {
  accessToken = $state<string | null>(null);
  googleUser = $state<GoogleUserInfo | null>(null);
  adminDisplayName = $state<string | null>(null);
  isRemembered = $state(false);
  redirectTo = $state<string | null>(null);
  initialized = $state(false);
  cachedPicture = $state<string | null>(null);
  authType = $state<"admin" | "resident" | null>(null);
  isInstanceAdmin = $state(false);
  userId = $state<string>("");

  get displayName(): string {
    return this.adminDisplayName || this.googleUser?.name || "";
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
      const savedGoogleUser = localStorage.getItem(LS_KEYS.GOOGLE_USER);
      const remembered = localStorage.getItem(LS_KEYS.REMEMBER) === "true";

      if (remembered && savedToken && savedGoogleUser) {
        this.accessToken = savedToken;
        this.googleUser = JSON.parse(savedGoogleUser);
        this.isRemembered = true;
        this.cachedPicture = localStorage.getItem(LS_KEYS.CACHED_PICTURE);
        this.authType = (localStorage.getItem(LS_KEYS.AUTH_TYPE) as "admin" | "resident") || null;
        this.isInstanceAdmin = localStorage.getItem(LS_KEYS.IS_ADMIN) === "true";
        const savedDisplayName = localStorage.getItem(LS_KEYS.DISPLAY_NAME);
        if (savedDisplayName) {
          this.adminDisplayName = savedDisplayName;
        }
        const savedUserId = localStorage.getItem(LS_KEYS.USER_ID);
        if (savedUserId) {
          this.userId = savedUserId;
        }
      }
      this.initialized = true;
    }
  }

  setUserId(id: string) {
    this.userId = id;
    if (browser && this.isRemembered) {
      if (id) {
        localStorage.setItem(LS_KEYS.USER_ID, id);
      } else {
        localStorage.removeItem(LS_KEYS.USER_ID);
      }
    }
  }

  setAdminDisplayName(name: string) {
    this.adminDisplayName = name;
    if (browser) {
      localStorage.setItem(LS_KEYS.DISPLAY_NAME, name);
    }
  }

  async ensureCachedPicture() {
    if (
      !browser ||
      !this.googleUser ||
      this.cachedPicture ||
      this.googleUser.picture === undefined
    ) {
      return;
    }

    try {
      const response = await fetch(this.googleUser.picture);
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
    googleUser: GoogleUserInfo,
    remember: boolean,
    residentId: string,
    type: "admin" | "resident",
    isInstanceAdmin: boolean = false
  ) {
    this.accessToken = token;
    if (residentId) {
      this.userId = residentId;
    }

    // A new session means a different identity; drop cached sheet/server data
    // so the previous user's data is never served.
    if (browser) {
      import("$api/services/common").then(({ invalidateCache }) => {
        invalidateCache();
      });
      import("$utils/api-client").then(({ invalidateServerCache }) => {
        invalidateServerCache();
      });
    }

    // Normalize user photo URL to high resolution
    if (googleUser.picture) {
      googleUser.picture = this.getHighResPictureUrl(googleUser.picture);
    }

    this.googleUser = googleUser;
    this.isRemembered = remember;
    this.authType = type;
    this.isInstanceAdmin = isInstanceAdmin;

    if (browser && remember) {
      localStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
      localStorage.setItem(LS_KEYS.GOOGLE_USER, JSON.stringify(googleUser));
      localStorage.setItem(LS_KEYS.REMEMBER, "true");
      localStorage.setItem(LS_KEYS.AUTH_TYPE, type);
      localStorage.setItem(LS_KEYS.IS_ADMIN, String(isInstanceAdmin));
      if (this.userId) {
        localStorage.setItem(LS_KEYS.USER_ID, this.userId);
      }
      this.ensureCachedPicture();
    }
  }

  signOut() {
    this.accessToken = null;
    this.googleUser = null;
    this.adminDisplayName = null;
    this.isRemembered = false;

    if (browser) {
      import("$api/services/common").then(({ supabase, invalidateCache }) => {
        invalidateCache();
        if (supabase) {
          supabase.auth.signOut();
        }
      });
      import("$utils/api-client").then(({ invalidateServerCache }) => {
        invalidateServerCache();
      });
      localStorage.removeItem(LS_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(LS_KEYS.GOOGLE_USER);
      localStorage.removeItem(LS_KEYS.REMEMBER);
      localStorage.removeItem(LS_KEYS.CACHED_PICTURE);
      localStorage.removeItem(LS_KEYS.DISPLAY_NAME);
      localStorage.removeItem(LS_KEYS.AUTH_TYPE);
      localStorage.removeItem(LS_KEYS.IS_ADMIN);
      localStorage.removeItem(LS_KEYS.USER_ID);
      this.cachedPicture = null;
      this.authType = null;
      this.isInstanceAdmin = false;
      this.userId = "";
    }
  }

  async signIn(type: "admin" | "resident"): Promise<void> {
    return authService.signIn(type, this.redirectTo);
  }

  async handleCallback(rememberMe = true): Promise<boolean> {
    const success = await authService.handleCallback({
      accessToken: this.accessToken,
      authType: this.authType,
      redirectTo: this.redirectTo,
      rememberMe,
      onSession: (token, userInfo, remember, userId, type, isInstanceAdmin) => {
        this.setSession(token, userInfo, remember, userId, type, isInstanceAdmin);
      },
      onSignOut: () => {
        this.signOut();
      }
    });

    if (success) {
      this.redirectTo = null;
    }

    return success;
  }
}

export const auth = new AuthState();
