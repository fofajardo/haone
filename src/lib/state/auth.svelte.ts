import { supabase } from "$api/services/common";
import { settingsService } from "$api/services/settings-service";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { PUBLIC_DB_PROVIDER, PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import { LS_KEYS } from "$lib/constants";
import type { GoogleUserInfo, TokenExchangeResponse } from "$lib/types";
import { generatePKCEChallenge, generatePKCEVerifier } from "$utils/crypto";

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
    if (!browser) {
      return;
    }

    const residentScopes = ["openid", "profile", "email"];

    const adminScopes = [
      ...residentScopes,
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/spreadsheets"
    ];

    const scopes = (type === "admin" ? adminScopes : residentScopes).join(" ");

    const verifier = generatePKCEVerifier();
    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("pkce_auth_type", type);
    const challenge = await generatePKCEChallenge(verifier);

    const params = new URLSearchParams({
      client_id: PUBLIC_GI_CLIENT_ID,
      redirect_uri: window.location.origin + "/sign-in",
      response_type: "code",
      scope: scopes,
      state: this.redirectTo || (type === "admin" ? "/admin" : "/resident"),
      include_granted_scopes: "true",
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(rememberMe = true): Promise<boolean> {
    if (!browser) {
      return false;
    }

    if (this.accessToken && !window.location.search.includes("code=")) {
      const target = this.redirectTo || (this.authType === "admin" ? "/admin" : "/resident");
      await goto(target);
      this.redirectTo = null;
      return true;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const savedType =
      (sessionStorage.getItem("pkce_auth_type") as "admin" | "resident") || "resident";

    if (!code) {
      if (this.accessToken) {
        let target = this.redirectTo || (this.authType === "admin" ? "/admin" : "/resident");
        if (this.authType === "resident" && target.startsWith("/admin")) {
          target = "/resident";
        }
        await goto(target);
        this.redirectTo = null;
        return true;
      }
      return false;
    }

    const verifier = sessionStorage.getItem("pkce_verifier");
    if (!verifier) {
      throw new Error("Missing PKCE verifier");
    }

    const tokenResp = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: window.location.origin + "/sign-in"
      })
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.json();
      throw new Error(err.error_description || "Token exchange failed");
    }

    const { tokenData, userInfoData, userId, isInstanceAdmin } =
      (await tokenResp.json()) as TokenExchangeResponse;
    const { access_token: accessToken, id_token: idToken } = tokenData;

    this.setSession(accessToken, userInfoData, rememberMe, userId, savedType, isInstanceAdmin);

    if (PUBLIC_DB_PROVIDER === "supabase") {
      if (!supabase || !idToken) {
        throw new Error(
          "Supabase sign-in is not configured (missing Supabase client or ID token)."
        );
      }
      const { error: sbErr } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken
      });
      if (sbErr) {
        this.signOut();
        throw new Error(`Supabase sign-in failed: ${sbErr.message}`);
      }
    }

    if (savedType === "admin") {
      await settingsService.verifyAccess(accessToken);
    }

    sessionStorage.removeItem("pkce_verifier");
    sessionStorage.removeItem("pkce_auth_type");

    let target = state || this.redirectTo || (savedType === "admin" ? "/admin" : "/resident");
    if (savedType === "resident" && target.startsWith("/admin")) {
      target = "/resident";
    }
    await goto(target);
    this.redirectTo = null;
    return true;
  }
}

export const auth = new AuthState();
