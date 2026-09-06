import { json } from "@sveltejs/kit";
import { GI_CLIENT_SECRET, INSTANCE_ADMIN } from "$env/static/private";
import { PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { code, code_verifier, redirect_uri, client_id } = await request.json();

    let clientSecret = GI_CLIENT_SECRET;

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: client_id || PUBLIC_GI_CLIENT_ID,
        client_secret: clientSecret,
        code,
        code_verifier,
        grant_type: "authorization_code",
        redirect_uri
      })
    });

    const data = await tokenResp.json();
    if (!tokenResp.ok) return json(data, { status: tokenResp.status });

    const accessToken = data.access_token;

    // Fetch userinfo to check domain/admin
    const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userinfoResp.ok) {
      return json(
        { error: "failed_userinfo", message: "Failed to fetch profile info" },
        { status: 500 }
      );
    }

    const userData = await userinfoResp.json();
    const email = userData.email.trim().toLowerCase();

    const isInstanceAdmin = email === (INSTANCE_ADMIN || "").trim().toLowerCase();

    let userId = "";
    try {
      const { USER_COL, UserTag } = await import("$lib/types");
      const { PUBLIC_DB_PROVIDER, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
        await import("$env/static/public");

      let isStudent = true;

      if (PUBLIC_DB_PROVIDER === "supabase") {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
        const { data: dbUser } = await supabase
          .from("users")
          .select("id, tags")
          .ilike("email", email)
          .maybeSingle();

        if (dbUser) {
          userId = dbUser.id;
          const tags = Array.isArray(dbUser.tags) ? dbUser.tags : [];
          if (!tags.includes(UserTag.STUDENT)) {
            isStudent = false;
          }
        } else {
          isStudent = false;
        }
      } else {
        const { getSheetsClient, fetchSheetsData } = await import("$lib/server/api-helper");
        const saClient = await getSheetsClient();
        const [userRows] = await fetchSheetsData(saClient, ["users!A:P"]);
        const user = userRows.find((r: any) => {
          return (r[USER_COL.EMAIL] || "").toLowerCase() === email;
        });
        if (user) {
          userId = user[USER_COL.ID] || "";
          const tagsStr = (user[USER_COL.TAGS] || "").trim().toUpperCase();
          const tags = tagsStr.split(":").map((t: string) => t.trim());
          if (!tags.includes(UserTag.STUDENT)) {
            isStudent = false;
          }
        } else {
          isStudent = false;
        }
      }

      // Enforce domain check
      if (!isInstanceAdmin && !email.endsWith("@up.edu.ph") && isStudent) {
        return json(
          {
            error: "forbidden_domain",
            error_description: "Only @up.edu.ph emails allowed for students."
          },
          { status: 403 }
        );
      }
    } catch (e: any) {
      console.warn("User lookup in token endpoint failed:", e);
    }

    return json({
      ...data,
      user: {
        ...userData,
        id: userId
      },
      isInstanceAdmin
    });
  } catch (e: any) {
    return json({ error: "server_error", error_description: e.message }, { status: 500 });
  }
};
