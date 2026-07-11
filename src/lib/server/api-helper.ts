import { json } from "@sveltejs/kit";
import { GOOGLE_SERVICE_ACCOUNT_JSON, INSTANCE_ADMIN } from "$env/static/private";

/**
 * Base64url encoding helper
 */
function base64url(buffer: ArrayBuffer | string): string {
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
async function sign(input: string, pem: string): Promise<string> {
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
async function getServiceAccountToken(email: string, privateKey: string, scopes: string[]) {
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
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountToken(keys.client_email, keys.private_key, [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase"
  ]);
  return token;
}

/**
 * Generic fetch wrapper for Google APIs with Bearer auth and error handling.
 */
export async function fetchGoogleAPI(url: string, token: string, options: RequestInit = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  });

  if (!resp.ok) {
    if (resp.status === 429) {
      throw new Error("Google API rate limit exceeded. Please try again later.");
    }
    const err = await resp.text();
    throw new Error(`Google API Error (${resp.status}): ${err}`);
  }

  return resp;
}

/**
 * Fetches values from a spreadsheet range.
 */
export async function getSheetValues(token: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetchGoogleAPI(url, token);
  const data = await resp.json();
  return data.values || [];
}

/**
 * Appends values to a spreadsheet range.
 */
export async function appendSheetValue(
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetchGoogleAPI(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  return await resp.json();
}

/**
 * Updates values in a spreadsheet range.
 */
export async function updateSheetValue(
  token: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetchGoogleAPI(url, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  return await resp.json();
}

/**
 * Deletes a row from a specific sheet.
 */
export async function deleteSheetRow(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
) {
  // 1. Resolve sheetId
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchGoogleAPI(metaUrl, token);
  const data = await metaResp.json();
  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

  // 2. Delete dimension
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchGoogleAPI(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    })
  });
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

    // Resolve instance admin to allow bypass
    const isInstanceAdmin = email === (INSTANCE_ADMIN || "").trim().toLowerCase();

    // Resolve residentId and check tags if needed
    let residentId = "";
    let isStudent = true;
    if (email && !isInstanceAdmin) {
      try {
        const { USER_COL, UserTag } = await import("$lib/schemas");
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
          // New user signup is allowed to proceed to onboarding
          isStudent = false;
        }
      } catch (e) {
        // Silently fail, assume student check fails if sheet read fails
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
  if (auth.error) return auth;

  try {
    const { OFFICER_COL } = await import("$lib/schemas");
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
 * Standardized error response for API routes.
 */
export function serverError(e: any, context = "API Operation") {
  console.error(`${context} failed:`, e);
  return json({ error: "server_error", message: e.message }, { status: 500 });
}

export async function getSpreadsheetIdForSheet(sheetName: string): Promise<string> {
  const { PUBLIC_GS_SR_ID, PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID } = await import("$env/static/public");
  switch (sheetName) {
    case "laundry":
    case "achievements":
    case "achievement_records":
    case "settings":
    case "payment_requests":
    case "announcements":
    case "static_ip":
      return PUBLIC_GS_SR_ID;
    case "constants":
    case "accounts":
    case "journal_general":
      return PUBLIC_GS_AW_ID;
    case "users":
    case "directory":
    case "CURR":
      return PUBLIC_GS_RR_ID;
    default:
      throw new Error(`Unknown sheet name: ${sheetName}`);
  }
}

/**
 * Fetches multiple ranges from Google Sheets, including special handling for "TERM_CURR".
 * Returns an array of results corresponding to the input ranges.
 * If a range is "TERM_CURR", it fetches the value from the constants sheet.
 * Otherwise, it fetches the values from the specified sheet and range.
 */
export async function fetchSheetsData(token: string, ranges: string[]): Promise<any[]> {
  const promises = ranges.map(async (range) => {
    if (range === "TERM_CURR") {
      const spreadsheetId = await getSpreadsheetIdForSheet("constants");
      const values = await getSheetValues(token, spreadsheetId, "constants!A:C");
      const row = values.find((r: any) => (r[0] || "").trim() === "TERM_CURR");
      return row ? (row[1] || "").trim() : "";
    }
    const sheetName = range.split("!")[0];
    const spreadsheetId = await getSpreadsheetIdForSheet(sheetName);
    return getSheetValues(token, spreadsheetId, range);
  });
  return Promise.all(promises);
}

/**
 * Pure helper function to resolve resident account type from accounts sheet rows.
 */
export function resolveResidentAccountType(
  accRows: any[][],
  activeTerm: string,
  residentId: string
): string | null {
  // Column indices: RESIDENT_ID = 1, PERIOD = 2, TYPE = 11
  const account = accRows.find((r: any) => {
    return (r[2] || "").trim() === activeTerm && (r[1] || "").trim() === residentId;
  });
  if (account) {
    return (account[11] || "STUDENT").trim().toUpperCase();
  }
  return null;
}
