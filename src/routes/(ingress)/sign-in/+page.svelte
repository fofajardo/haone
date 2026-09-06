<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { generatePKCEVerifier, generatePKCEChallenge } from "$utils/crypto";
  import { Button } from "$ui/button";
  import { LoaderIcon } from "@lucide/svelte";
  import { goto, replaceState } from "$app/navigation";
  import { brandingState } from "$state/branding.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import { PUBLIC_GI_CLIENT_ID, PUBLIC_DB_PROVIDER } from "$env/static/public";
  import { supabase } from "$api/services/common";

  let isSigningIn = $state(false);
  let isLoadingAuth = $state(true);
  let rememberMe = $state(true);

  onMount(async () => {
    // If already logged in, go to appropriate dashboard
    if (auth.accessToken && !window.location.search.includes("code=")) {
      await goto(auth.authType === "admin" ? "/admin" : "/resident");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const savedType =
      (sessionStorage.getItem("pkce_auth_type") as "admin" | "resident") || "resident";

    if (code) {
      isSigningIn = true;
      let redirecting = false;
      try {
        const verifier = sessionStorage.getItem("pkce_verifier");
        if (!verifier) {
          throw new Error("Missing PKCE verifier");
        }

        // Exchange code for token
        const tokenResp = await fetch("/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: verifier,
            redirect_uri: window.location.origin + "/sign-in",
            client_id: PUBLIC_GI_CLIENT_ID
          })
        });

        if (!tokenResp.ok) {
          const err = await tokenResp.json();
          throw new Error(err.error_description || "Token exchange failed");
        }

        const tokenData = await tokenResp.json();
        const {
          access_token: accessToken,
          id_token: idToken,
          user: userInfo,
          isInstanceAdmin
        } = tokenData;

        auth.setSession(accessToken, userInfo, rememberMe, savedType, isInstanceAdmin);

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
            // Abort sign-in instead of entering a silently broken app.
            auth.logout();
            throw new Error(`Supabase sign-in failed: ${sbErr.message}`);
          }
        }

        if (savedType === "admin") {
          const { settingsService } = await import("$api/services/settings-service");
          await settingsService.verifyAccess(accessToken);
        }

        sessionStorage.removeItem("pkce_verifier");
        sessionStorage.removeItem("pkce_auth_type");

        redirecting = true;
        let target = state || auth.redirectTo || (savedType === "admin" ? "/admin" : "/resident");
        if (savedType === "resident" && target.startsWith("/admin")) {
          target = "/resident";
        }
        await goto(target);
        auth.redirectTo = null;
        return;
      } catch (e: any) {
        globalDialog.show("Sign-in Failed", e.message || "An unexpected error occurred.");
      } finally {
        if (!redirecting) {
          isSigningIn = false;
          replaceState(window.location.pathname, {});
          isLoadingAuth = false;
        }
      }
    }

    isLoadingAuth = false;

    // If already logged in, go to appropriate dashboard
    if (auth.accessToken) {
      let target = auth.redirectTo || (auth.authType === "admin" ? "/admin" : "/resident");
      if (auth.authType === "resident" && target.startsWith("/admin")) {
        target = "/resident";
      }
      goto(target);
      auth.redirectTo = null;
    }
  });

  async function handleLogin(type: "admin" | "resident" = "resident") {
    isSigningIn = true;

    const adminScopes = [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/spreadsheets"
    ];

    const residentScopes = ["openid", "profile", "email"];

    const scopes = (type === "admin" ? adminScopes : residentScopes).join(" ");

    // PKCE Setup
    const verifier = generatePKCEVerifier();
    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("pkce_auth_type", type);
    const challenge = await generatePKCEChallenge(verifier);

    const params = new URLSearchParams({
      client_id: PUBLIC_GI_CLIENT_ID,
      redirect_uri: window.location.origin + "/sign-in",
      response_type: "code",
      scope: scopes,
      state: auth.redirectTo || (type === "admin" ? "/admin" : "/resident"),
      include_granted_scopes: "true",
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
</script>

<div class="flex flex-col items-center justify-center">
  <div class="relative z-10 w-full max-w-sm space-y-6">
    <div class="flex flex-col items-center space-y-8 text-center">
      <img
        src={brandingState.profile.logoUrl}
        alt={brandingState.profile.logoAlt}
        class="h-28 w-auto object-contain transition-all duration-500 hover:scale-[1.02] dark:hidden"
      />
      <img
        src={brandingState.profile.logoUrlDark || brandingState.profile.logoUrl}
        alt={brandingState.profile.logoAlt}
        class="hidden h-28 w-auto object-contain transition-all duration-500 hover:scale-[1.02] dark:block"
      />
    </div>

    <div class="animate-in space-y-3 pt-6 duration-1000 fade-in slide-in-from-bottom-4">
      {#if isSigningIn || isLoadingAuth}
        <div
          class="flex h-30 animate-in items-center justify-center space-x-3 duration-500 zoom-in-95 fade-in"
        >
          <LoaderIcon class="h-5 w-5 animate-spin text-foreground" />
        </div>
      {:else}
        <Button
          onclick={() => handleLogin("resident")}
          class="h-14 w-full rounded-xl bg-foreground text-base font-bold text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Sign In
        </Button>

        <Button
          variant="ghost"
          onclick={() => handleLogin("admin")}
          class="h-12 w-full rounded-xl text-sm font-bold transition-all hover:bg-muted active:scale-[0.98]"
        >
          Sign In as House Council Officer
        </Button>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: var(--background);
  }
</style>
