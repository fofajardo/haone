import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { PUBLIC_DB_PROVIDER, PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import type { GoogleUserInfo, TokenExchangeResponse } from "$lib/types";
import { ACCOUNT_COL } from "$lib/types";
import { generatePKCEChallenge, generatePKCEVerifier } from "$utils/crypto";
import { json } from "@sveltejs/kit";

/**
 * Base64url encoding helper
 */
export function base64url(buffer: ArrayBuffer | string): string {
  const bytes =
    typeof buffer === "string" ? new TextEncoder().encode(buffer) : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Signs a payload using RS256 with a private key.
 */
export async function sign(input: string, pem: string): Promise<string> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  );
  const binaryKey = Uint8Array.from(atob(pemContents.replace(/\s/g, "")), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input)
  );

  return base64url(signature);
}

/**
 * Generates a Google Access Token using a service account JWT.
 */
export async function getServiceAccountToken(email: string, privateKey: string, scopes: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(input, privateKey);
  const jwt = `${input}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

/**
 * Creates an authorized Google Sheets client (token) using the service account.
 */
export async function getSheetsClient() {
  const { GOOGLE_SERVICE_ACCOUNT_JSON } = await import("$env/static/private");
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountToken(keys.client_email, keys.private_key, [
    "https://www.googleapis.com/auth/spreadsheets"
  ]);
  return token;
}

/**
 * Creates an authorized Firebase client (token) using the service account.
 */
export async function getFirebaseToken() {
  const { GOOGLE_SERVICE_ACCOUNT_JSON } = await import("$env/static/private");
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountToken(keys.client_email, keys.private_key, [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase"
  ]);
  return token;
}

/**
 * Standardized resident authentication for API routes.
 * Verifies the Bearer token with Google and returns the user's email.
 */
export async function authenticateResident(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.split(" ")[1];

  try {
    const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!userinfoResp.ok) {
      return { error: json({ error: "Invalid token" }, { status: 401 }) };
    }

    const userData = await userinfoResp.json();
    const email = userData.email.trim().toLowerCase();

    const { INSTANCE_ADMIN } = await import("$env/static/private");
    // Resolve instance admin to allow bypass
    const isInstanceAdmin = email === (INSTANCE_ADMIN || "").trim().toLowerCase();

    // Resolve residentId and check tags if needed
    let residentId = "";
    let isStudent = true;
    if (email && !isInstanceAdmin) {
      try {
        const {
          PUBLIC_DB_PROVIDER: dbProvider,
          PUBLIC_SUPABASE_URL,
          PUBLIC_SUPABASE_PUBLISHABLE_KEY
        } = await import("$env/static/public");
        if (dbProvider === "supabase") {
          // Server-side client: created locally so the server never imports the
          // client-side service module (which pulls in $state runes).
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
          const { data: dbUser } = await supabase
            .from("users")
            .select("id, tags")
            .ilike("email", email)
            .maybeSingle();
          if (dbUser) {
            residentId = dbUser.id;
            const tags = Array.isArray(dbUser.tags) ? dbUser.tags : [];
            const { UserTag } = await import("$lib/types");
            if (!tags.includes(UserTag.STUDENT)) {
              isStudent = false;
            }
          } else {
            isStudent = false;
          }
        } else {
          const { USER_COL, UserTag } = await import("$lib/types");
          const { fetchSheetsData } = await import("$lib/server/api-helper");
          const saToken = await getSheetsClient();
          const [users] = await fetchSheetsData(saToken, ["users!A:P"]);
          const user = users.find((r: any) => {
            return (r[USER_COL.EMAIL] || "").toLowerCase() === email;
          });
          if (user) {
            residentId = user[USER_COL.ID];
            const tagsStr = (user[USER_COL.TAGS] || "").trim().toUpperCase();
            const tags = tagsStr.split(":").map((t: string) => {
              return t.trim();
            });
            if (!tags.includes(UserTag.STUDENT)) {
              isStudent = false;
            }
          } else {
            isStudent = false;
          }
        }
      } catch (e) {
        console.error("[auth-service] Resident user lookup failed:", e);
      }
    }

    // Domain restriction: all sign-ins must be @up.edu.ph, UNLESS it's the instance admin or non-student
    if (!isInstanceAdmin && !email.endsWith("@up.edu.ph") && isStudent) {
      return {
        error: json(
          {
            error: "forbidden_domain",
            message: "Only @up.edu.ph emails are allowed for students."
          },
          { status: 403 }
        )
      };
    }

    return { email, residentId, isInstanceAdmin };
  } catch (e: any) {
    console.error("Auth validation failed:", e);
    return {
      error: json({ error: "Authentication check failed", message: e.message }, { status: 500 })
    };
  }
}

/**
 * Standardized admin authentication for API routes.
 */
export async function authenticateAdmin(request: Request) {
  const auth = await authenticateResident(request);
  if (auth.error) {
    return auth;
  }

  try {
    const { OFFICER_COL } = await import("$lib/types");
    const { fetchSheetsData } = await import("$lib/server/api-helper");
    const token = await getSheetsClient();
    const [directory] = await fetchSheetsData(token, ["directory!A:H"]);

    // Check if user email is in the directory sheet
    const officer = directory.find(
      (r: any) => (r[OFFICER_COL.EMAIL] || "").toLowerCase() === auth.email
    );

    if (!officer) {
      return {
        error: json({ error: "Forbidden: Admin access required (Officer only)" }, { status: 403 })
      };
    }

    return auth;
  } catch (e: any) {
    return {
      error: json({ error: "Admin check failed", message: e.message }, { status: 500 })
    };
  }
}

/**
 * Pure helper function to resolve resident account type from accounts sheet rows.
 */
export function resolveResidentAccountType(
  accRows: any[][],
  activeTerm: string,
  residentId: string
): string | null {
  const account = accRows.find((r: any) => {
    return (
      (r[ACCOUNT_COL.PERIOD] || "").trim() === activeTerm &&
      (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId
    );
  });
  if (account) {
    const rawType = (account[ACCOUNT_COL.TYPE] || "").trim().toUpperCase();
    return rawType || null;
  }
  return null;
}

/**
 * Initiates Google OAuth sign-in flow.
 */
export async function signIn(
  type: "admin" | "resident",
  redirectTo?: string | null
): Promise<void> {
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
    state: redirectTo || (type === "admin" ? "/admin" : "/resident"),
    include_granted_scopes: "true",
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface AuthExchangeResult {
  tokenData: {
    access_token: string;
    id_token: string;
  };
  userInfoData: GoogleUserInfo;
  userId: string;
  isInstanceAdmin: boolean;
  savedType: "admin" | "resident";
  target: string;
}

/**
 * Exchanges auth code for tokens and validates with backend.
 */
export async function exchangeAuthCode(): Promise<AuthExchangeResult | null> {
  if (!browser) {
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");
  const savedType =
    (sessionStorage.getItem("pkce_auth_type") as "admin" | "resident") || "resident";

  if (!code) {
    return null;
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

  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem("pkce_auth_type");

  let target = state || (savedType === "admin" ? "/admin" : "/resident");
  if (savedType === "resident" && target.startsWith("/admin")) {
    target = "/resident";
  }

  return {
    tokenData,
    userInfoData,
    userId,
    isInstanceAdmin,
    savedType,
    target
  };
}

export interface CallbackOptions {
  accessToken: string | null;
  authType: "admin" | "resident" | null;
  redirectTo: string | null;
  rememberMe?: boolean;
  onSession: (
    token: string,
    userInfo: GoogleUserInfo,
    remember: boolean,
    userId: string,
    type: "admin" | "resident",
    isInstanceAdmin: boolean
  ) => void;
  onSignOut: () => void;
}

/**
 * Handles OAuth callback workflow.
 */
export async function handleCallback(options: CallbackOptions): Promise<boolean> {
  if (!browser) {
    return false;
  }

  const { accessToken, authType, redirectTo, rememberMe = true, onSession, onSignOut } = options;

  if (accessToken && !window.location.search.includes("code=")) {
    const target = redirectTo || (authType === "admin" ? "/admin" : "/resident");
    await goto(target);
    return true;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (!code) {
    if (accessToken) {
      let target = redirectTo || (authType === "admin" ? "/admin" : "/resident");
      if (authType === "resident" && target.startsWith("/admin")) {
        target = "/resident";
      }
      await goto(target);
      return true;
    }
    return false;
  }

  const exchangeResult = await exchangeAuthCode();
  if (!exchangeResult) {
    return false;
  }

  const {
    tokenData,
    userInfoData,
    userId,
    isInstanceAdmin,
    savedType,
    target: exchangeTarget
  } = exchangeResult;
  const { access_token: newAccessToken, id_token: idToken } = tokenData;

  onSession(newAccessToken, userInfoData, rememberMe, userId, savedType, isInstanceAdmin);

  if (PUBLIC_DB_PROVIDER === "supabase") {
    const { supabase } = await import("$api/services/common");
    if (!supabase || !idToken) {
      throw new Error("Supabase sign-in is not configured (missing Supabase client or ID token).");
    }
    const { error: sbErr } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken
    });
    if (sbErr) {
      onSignOut();
      throw new Error(`Supabase sign-in failed: ${sbErr.message}`);
    }
  }

  if (savedType === "admin") {
    const { settingsService } = await import("$api/services/settings-service");
    await settingsService.verifyAccess(newAccessToken);
  }

  let finalTarget = redirectTo || exchangeTarget;
  if (savedType === "resident" && finalTarget.startsWith("/admin")) {
    finalTarget = "/resident";
  }
  await goto(finalTarget);
  return true;
}

export const authService = {
  base64url,
  sign,
  getServiceAccountToken,
  getSheetsClient,
  getFirebaseToken,
  authenticateResident,
  authenticateAdmin,
  resolveResidentAccountType,
  signIn,
  exchangeAuthCode,
  handleCallback
};
