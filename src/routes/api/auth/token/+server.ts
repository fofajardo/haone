import { json } from "@sveltejs/kit";
import { GI_CLIENT_SECRET, RESIDENT_GI_CLIENT_SECRET } from "$env/static/private";
import { PUBLIC_GI_CLIENT_ID, PUBLIC_RESIDENT_GI_CLIENT_ID } from "$env/static/public";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { code, code_verifier, redirect_uri, client_id } = await request.json();

    let clientSecret = GI_CLIENT_SECRET;
    if (client_id === PUBLIC_RESIDENT_GI_CLIENT_ID) {
      clientSecret = RESIDENT_GI_CLIENT_SECRET;
    }

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

    if (!tokenResp.ok) {
      return json(data, { status: tokenResp.status });
    }

    return json(data);
  } catch (e: any) {
    return json({ error: "server_error", error_description: e.message }, { status: 500 });
  }
};
