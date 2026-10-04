import { createCredentialJwt, lookupUser } from "$api/services/auth-service";
import { GI_CLIENT_SECRET, INSTANCE_ADMIN } from "$env/static/private";
import { PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import type {
  GoogleAuthToken,
  GoogleUserInfo,
  TokenExchangeResponse,
  UserRecord
} from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const URL_TOKEN_EXCHANGE = "https://oauth2.googleapis.com/token";
const URL_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

function getHighResPictureUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace(/([=|\/])s\d+(-[c|p|o|g])?(\/|$)/, "$1s384-c$3");
}

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

    let user: UserRecord | null = null;
    try {
      const result = await lookupUser(email);
      user = result.user;

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

    // Build a dummy user record since the signed-in user does not yet exist
    // in the database. This allows the user to proceed to the app and create
    // their account. The user will be prompted to fill in the missing details
    // during the onboarding process.
    if (!user) {
      user = {
        email,
        lastName: (userInfoData.family_name || "").trim().toUpperCase(),
        firstName: (userInfoData.given_name || "").trim().toUpperCase(),
        middleName: "",
        suffix: "",
        overrideName: "",
        displayName:
          userInfoData.family_name && userInfoData.given_name
            ? `${userInfoData.family_name.trim().toUpperCase()}, ${userInfoData.given_name.trim().toUpperCase()}`
            : (userInfoData.name || "").trim(),
        displayNameFormal: (userInfoData.name || "").trim(),
        studentNo: "",
        secondaryContact: "",
        college: "",
        program: "",
        id: crypto.randomUUID()
      };
    }

    // Normalize user photo URL to high resolution
    user.avatarUrl = getHighResPictureUrl(userInfoData.picture);

    let credentialJwt = "";
    try {
      credentialJwt = await createCredentialJwt({
        email,
        sub: user.id,
        isInstanceAdmin
      });
    } catch (jwtErr: any) {
      console.error("Failed to generate credential JWT:", jwtErr);
      return json(
        {
          error: "server_error",
          error_description: "Failed to generate credential token"
        },
        { status: 500 }
      );
    }

    return json({
      tokenData,
      user,
      isInstanceAdmin,
      credentialJwt
    } satisfies TokenExchangeResponse);
  } catch (e: any) {
    console.error(e);
    return json({ error: "server_error", error_description: e.message }, { status: 500 });
  }
};
