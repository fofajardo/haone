import { GI_CLIENT_SECRET, INSTANCE_ADMIN } from "$env/static/private";
import { PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import type { GoogleAuthToken, GoogleUserInfo, TokenExchangeResponse } from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const URL_TOKEN_EXCHANGE = "https://oauth2.googleapis.com/token";
const URL_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { code, code_verifier, redirect_uri } = await request.json();

    // Exchange authorization code for refresh and access tokens.
    const tokenResponse = await fetch(URL_TOKEN_EXCHANGE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: PUBLIC_GI_CLIENT_ID,
        client_secret: GI_CLIENT_SECRET,
        code,
        code_verifier,
        grant_type: "authorization_code",
        redirect_uri
      })
    });

    const tokenData: GoogleAuthToken = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return json(tokenData, { status: tokenResponse.status });
    }

    // Fetch user profile info from Google.
    const userInfoResponse = await fetch(URL_USERINFO, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userInfoResponse.ok) {
      return json({ error_description: "Failed to fetch profile info" }, { status: 500 });
    }

    const userInfoData: GoogleUserInfo = await userInfoResponse.json();
    const email = userInfoData.email.trim().toLowerCase();
    const isInstanceAdmin = email === (INSTANCE_ADMIN || "").trim().toLowerCase();

    let userId = "";
    try {
      const result = await lookupUser(email);
      userId = result.userId;

      // Enforce domain check
      if (!isInstanceAdmin && !email.endsWith("@up.edu.ph") && result.isStudent) {
        return json(
          {
            error: "forbidden_domain",
            error_description: "Only @up.edu.ph emails allowed for students."
          },
          { status: 403 }
        );
      }
    } catch (e: any) {
      console.error("User lookup in token endpoint failed:", e);
      return json(
        {
          error: "server_error",
          error_description: e.message || "User lookup in token endpoint failed."
        },
        { status: 500 }
      );
    }

    return json({
      tokenData,
      userInfoData,
      userId,
      isInstanceAdmin
    } satisfies TokenExchangeResponse);
  } catch (e: any) {
    return json({ error: "server_error", error_description: e.message }, { status: 500 });
  }
};

async function lookupUserSupabase(email: string): Promise<{ userId: string; isStudent: boolean }> {
  const { UserTag } = await import("$lib/types");
  const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    await import("$env/static/public");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, tags")
    .ilike("email", email)
    .maybeSingle();

  if (dbUser) {
    const tags = Array.isArray(dbUser.tags) ? dbUser.tags : [];
    return {
      userId: dbUser.id,
      isStudent: tags.includes(UserTag.STUDENT)
    };
  }

  return { userId: "", isStudent: false };
}

async function lookupUserSheets(email: string): Promise<{ userId: string; isStudent: boolean }> {
  const { USER_COL, UserTag } = await import("$lib/types");
  const { getSheetsClient, fetchSheetsData } = await import("$api/services/server-sheets-service");
  const saClient = await getSheetsClient();
  const [userRows] = await fetchSheetsData(saClient, ["users!A:P"]);
  const user = userRows.find((r: any) => {
    return (r[USER_COL.EMAIL] || "").toLowerCase() === email;
  });

  if (user) {
    const tagsStr = (user[USER_COL.TAGS] || "").trim().toUpperCase();
    const tags = tagsStr.split(":").map((t: string) => t.trim());
    return {
      userId: user[USER_COL.ID] || "",
      isStudent: tags.includes(UserTag.STUDENT)
    };
  }

  return { userId: "", isStudent: false };
}

async function lookupUser(email: string): Promise<{ userId: string; isStudent: boolean }> {
  const { PUBLIC_DB_PROVIDER } = await import("$env/static/public");

  switch (PUBLIC_DB_PROVIDER) {
    case "supabase": {
      return await lookupUserSupabase(email);
    }
    case "sheets":
    default: {
      return await lookupUserSheets(email);
    }
  }
}
