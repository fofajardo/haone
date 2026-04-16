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

  constructor() {
    if (browser) {
      const savedToken = localStorage.getItem(LS_KEYS.ACCESS_TOKEN);
      const savedUser = localStorage.getItem(LS_KEYS.USER);
      const remembered = localStorage.getItem(LS_KEYS.REMEMBER) === "true";

      if (remembered && savedToken && savedUser) {
        this.accessToken = savedToken;
        this.user = JSON.parse(savedUser);
        this.isRemembered = true;
      }
    }
  }

  setSession(token: string, user: UserInfo, remember: boolean) {
    this.accessToken = token;
    this.user = user;
    this.isRemembered = remember;

    if (browser && remember) {
      localStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
      localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(LS_KEYS.REMEMBER, "true");
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
