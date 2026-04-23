import { browser } from "$app/environment";
import { LS_KEYS } from "./constants";

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

class AuthState {
  accessToken = $state<string | null>(null);
  user = $state<UserInfo | null>(null);
  isRemembered = $state(false);
  lastError = $state<{ title: string; description: string } | null>(null);
  redirectTo = $state<string | null>(null);
  initialized = $state(false);
  cachedPicture = $state<string | null>(null);
  authType = $state<"admin" | "resident" | null>(null);

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
      }
      this.initialized = true;
    }
  }

  async ensureCachedPicture() {
    if (!this.user || !browser) return;

    // If we already have a cached picture in memory, skip
    if (this.cachedPicture) return;

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

  setSession(
    token: string,
    user: UserInfo,
    remember: boolean,
    type: "admin" | "resident" = "admin"
  ) {
    this.accessToken = token;
    this.user = user;
    this.isRemembered = remember;
    this.authType = type;

    if (browser && remember) {
      localStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
      localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(LS_KEYS.REMEMBER, "true");
      localStorage.setItem("halsk.auth.type", type);
      this.ensureCachedPicture();
    }
  }

  logout() {
    this.accessToken = null;
    this.user = null;
    this.isRemembered = false;

    if (browser) {
      localStorage.removeItem(LS_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(LS_KEYS.USER);
      localStorage.removeItem(LS_KEYS.REMEMBER);
      localStorage.removeItem(LS_KEYS.CACHED_PICTURE);
      localStorage.removeItem("halsk.auth.type");
      this.cachedPicture = null;
      this.authType = null;
    }
  }

  async fetchUserInfo(token: string) {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error("Failed to fetch user info");
    return (await resp.json()) as UserInfo;
  }
}

export const auth = new AuthState();
