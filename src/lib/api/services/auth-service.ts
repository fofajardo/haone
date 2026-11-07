import { GOOGLE_SERVICE_ACCOUNT_JSON, JWT_SECRET, SUPABASE_SECRET_KEY } from "$env/static/private";
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import type { CredentialPayload, UserRecord } from "$lib/types";
import { OfficerStatus, UserTag } from "$lib/types";
import { createClient } from "@supabase/supabase-js";
import { json } from "@sveltejs/kit";
import { base64url, jwtVerify, SignJWT } from "jose";

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

  return base64url.encode(new Uint8Array(signature));
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

  const encodedHeader = base64url.encode(JSON.stringify(header));
  const encodedPayload = base64url.encode(JSON.stringify(payload));
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
 * Creates an authorized Firebase client (token) using the service account.
 */
export async function getFirebaseToken() {
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountToken(keys.client_email, keys.private_key, [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase"
  ]);
  return token;
}

/**
 * Creates a signed credential JWT valid for 1 hour.
 */
export async function createCredentialJwt(payload: CredentialPayload): Promise<string> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);

  return new SignJWT({
    email: payload.email,
    sub: payload.sub,
    isInstanceAdmin: payload.isInstanceAdmin
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
}

/**
 * Verifies a signed credential JWT using jose. Returns null if invalid or expired.
 */
export async function verifyCredentialJwt(token: string): Promise<CredentialPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);

    const { payload } = await jwtVerify<CredentialPayload>(token, secretKey, {
      algorithms: ["HS256"]
    });

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Validates the incoming HTTP Authorization header Bearer token against our
 * HMAC-signed 1-hour session token using jose.
 *
 * Performs local cryptographic verification with zero external network calls.
 * Extracts authenticated session claims (`email`, `residentId`, `isInstanceAdmin`)
 * or returns a 401 Unauthorized JSON response on missing/invalid/expired token.
 */
export async function authenticateResident(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.split(" ")[1];

  try {
    const session = await verifyCredentialJwt(token);
    if (!session) {
      return { error: json({ error: "Invalid or expired session token" }, { status: 401 }) };
    }

    return {
      email: session.email,
      residentId: session.sub,
      isInstanceAdmin: session.isInstanceAdmin
    };
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
    if (!auth.email) {
      return {
        error: json({ error: "Forbidden: Admin access required (Officer only)" }, { status: 403 })
      };
    }

    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data: officer, error: officerErr } = await supabase
      .from("officers")
      .select("id, status")
      .ilike("email", auth.email)
      .eq("status", OfficerStatus.ACTIVE)
      .maybeSingle();

    if (officerErr) {
      console.error("Failed to query officers table for admin auth:", officerErr);
      return {
        error: json({ error: "Admin check failed", message: officerErr.message }, { status: 500 })
      };
    }

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

export async function lookupUser(
  email: string
): Promise<{ user: UserRecord | null; isStudent: boolean }> {
  const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY);
  const { data: dbUser } = await supabase
    .from("users_view")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (dbUser) {
    const tags = Array.isArray(dbUser.tags) ? dbUser.tags : [];
    const user: UserRecord = {
      id: dbUser.id,
      email: dbUser.email,
      lastName: dbUser.last_name || "",
      firstName: dbUser.first_name || "",
      middleName: dbUser.middle_name || "",
      suffix: dbUser.suffix || "",
      overrideName: dbUser.override_name || "",
      displayName: dbUser.display_name || "",
      displayNameFormal: dbUser.display_name_fl || "",
      studentNo: dbUser.student_no || "",
      secondaryContact: dbUser.secondary_contact || "",
      college: dbUser.college || "",
      program: dbUser.degree_program || ""
    };
    return {
      user,
      isStudent: tags.includes(UserTag.STUDENT)
    };
  }

  return { user: null, isStudent: false };
}

export const authService = {
  sign,
  getServiceAccountToken,
  getFirebaseToken,
  createCredentialJwt,
  verifyCredentialJwt,
  authenticateResident,
  authenticateAdmin,
  lookupUser
};
