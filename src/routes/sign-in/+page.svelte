<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { onMount } from "svelte";
  import { testAccess } from "$lib/google-sheets";
  import { generatePKCEVerifier, generatePKCEChallenge } from "$lib/crypto";
  import { Button } from "$lib/components/ui/button";
  import { LogIn, LoaderCircle } from "lucide-svelte";
  import { goto, replaceState } from "$app/navigation";
  import branding from "$lib/branding.json";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { PUBLIC_GI_CLIENT_ID } from "$env/static/public";

  let isLoggingIn = $state(false);
  let isLoadingAuth = $state(true);
  let rememberMe = $state(true);

  let alertState = $state({ open: false, title: "", description: "" });

  function showError(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    // Check for PKCE Authorization Code callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (code) {
      isLoggingIn = true;
      try {
        const verifier = sessionStorage.getItem("pkce_verifier");
        if (!verifier) {
          throw new Error("Missing PKCE verifier");
        }

        // Exchange code for token via our server-side API.
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

        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;

        const userInfo = await auth.fetchUserInfo(accessToken);

        const spreadsheetId = (branding.default as any).spreadsheetId;
        await testAccess(spreadsheetId, accessToken);
        auth.setSession(accessToken, userInfo, rememberMe);

        sessionStorage.removeItem("pkce_verifier");

        // Redirect back or to state
        goto(state || auth.redirectTo || "/admin");
        auth.redirectTo = null;
        return;
      } catch (e: any) {
        // Only set error if not already handled by a service (which would open the alert)
        if (!alertState.open) {
          auth.lastError = {
            title: "Sign-in Failed",
            description: e.message || "An unexpected error occurred."
          };
        }
      } finally {
        isLoggingIn = false;
        replaceState(window.location.pathname, {});
      }
    }

    isLoadingAuth = false;

    // If already logged in, go to admin
    if (auth.accessToken) {
      goto(auth.redirectTo || "/admin");
      auth.redirectTo = null;
    }
  });

  $effect(() => {
    if (auth.lastError) {
      showError(auth.lastError.title, auth.lastError.description);
      auth.lastError = null;
    }
  });

  async function handleLogin() {
    isLoggingIn = true;
    const clientId = PUBLIC_GI_CLIENT_ID;
    const scopes = [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ].join(" ");

    // PKCE Setup
    const verifier = generatePKCEVerifier();
    sessionStorage.setItem("pkce_verifier", verifier);
    const challenge = await generatePKCEChallenge(verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin + "/sign-in",
      response_type: "code",
      scope: scopes,
      state: auth.redirectTo || "/admin",
      include_granted_scopes: "true",
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
</script>

<div
  class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6 md:p-12 {uiSettings.fontFamily ===
  'inter'
    ? 'font-sans'
    : ''} {uiSettings.displayDensity !== 'default'
    ? `acc-density-${uiSettings.displayDensity}`
    : ''}"
  class:font-archivo={uiSettings.fontFamily === "archivo"}
  class:font-shantell={uiSettings.fontFamily === "shantell"}
  class:acc-reduced-motion={uiSettings.reducedMotion}
>
  <div class="relative z-10 w-full max-w-sm space-y-4">
    <div class="flex flex-col items-center space-y-8 text-center">
      <img
        src={branding.default.logoUrl}
        alt={branding.default.logoAlt}
        class="h-28 w-auto object-contain transition-all duration-500 hover:scale-[1.02] dark:hidden"
      />
      <img
        src={branding.default.logoUrlDark || branding.default.logoUrl}
        alt={branding.default.logoAlt}
        class="hidden h-28 w-auto object-contain transition-all duration-500 hover:scale-[1.02] dark:block"
      />
    </div>

    <div class="animate-in pt-6 duration-1000 fade-in slide-in-from-bottom-4">
      <Button
        onclick={handleLogin}
        disabled={isLoggingIn || isLoadingAuth}
        class="h-14 w-full rounded-xl bg-foreground text-base font-bold text-background transition-all hover:opacity-90 active:scale-[0.98]"
      >
        {#if isLoggingIn || isLoadingAuth}
          <LoaderCircle class="mr-2 h-5 w-5 animate-spin" />
          {isLoadingAuth ? "Loading…" : "Signing in…"}
        {:else}
          <LogIn class="mr-2 h-5 w-5" />
          Sign in with Google
        {/if}
      </Button>
    </div>
  </div>

  <div
    class="absolute right-0 bottom-12 left-0 flex animate-in flex-col items-center gap-4 text-center duration-1000 fade-in slide-in-from-bottom-2"
  >
    <div class="h-px w-8 bg-border"></div>
    <div class="flex cursor-default items-center gap-2">
      <span class="text-[9px] font-bold tracking-widest text-muted-foreground uppercase"
        >Powered by</span
      >
      <div class="flex items-center gap-1.5">
        <img src="/ha1.svg" alt="HAOne" class="h-4 w-4" />
        <span class="text-xs font-black tracking-tighter text-foreground">HAOne</span>
      </div>
    </div>
  </div>
</div>

<!-- Global Error Alert -->
<AlertDialog.Root bind:open={alertState.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{alertState.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {@html alertState.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertState.open = false)}>Close</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<style>
  :global(body) {
    background-color: var(--background);
  }
</style>
