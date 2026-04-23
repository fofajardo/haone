<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { onMount } from "svelte";
  import { testAccess } from "$lib/google-sheets";
  import { generatePKCEVerifier, generatePKCEChallenge } from "$lib/crypto";
  import { Button } from "$lib/components/ui/button";
  import { User, LoaderIcon } from "lucide-svelte";
  import { goto, replaceState } from "$app/navigation";
  import branding from "$lib/branding.json";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { PUBLIC_GI_CLIENT_ID, PUBLIC_RESIDENT_GI_CLIENT_ID } from "$env/static/public";

  let isSigningIn = $state(false);
  let isLoadingAuth = $state(true);
  let rememberMe = $state(true);
  let currentAuthType = $state<"admin" | "resident">("resident");

  let alertState = $state({ open: false, title: "", description: "" });

  function showError(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

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

        const clientId = savedType === "admin" ? PUBLIC_GI_CLIENT_ID : PUBLIC_RESIDENT_GI_CLIENT_ID;

        // Exchange code for token
        const tokenResp = await fetch("/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: verifier,
            redirect_uri: window.location.origin + "/sign-in",
            client_id: clientId
          })
        });

        if (!tokenResp.ok) {
          const err = await tokenResp.json();
          throw new Error(err.error_description || "Token exchange failed");
        }

        const { access_token: accessToken } = await tokenResp.json();

        // Parallelize profile fetch and access verification
        const [userInfo] = await Promise.all([
          auth.fetchUserInfo(accessToken),
          savedType === "admin"
            ? testAccess(uiSettings.accountingWorkbookId, accessToken)
            : Promise.resolve()
        ]);

        if (savedType === "resident" && !userInfo.email.endsWith("@up.edu.ph")) {
          throw new Error("Only UP Mail accounts (@up.edu.ph) are allowed for residents.");
        }

        auth.setSession(accessToken, userInfo, rememberMe, savedType);

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
        if (!auth.lastError) {
          auth.lastError = {
            title: "Sign-in Failed",
            description: e.message || "An unexpected error occurred."
          };
        }
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

  $effect(() => {
    if (auth.lastError) {
      showError(auth.lastError.title, auth.lastError.description);
      auth.lastError = null;
    }
  });

  async function handleLogin(type: "admin" | "resident" = "resident") {
    isSigningIn = true;
    currentAuthType = type;
    const clientId = type === "admin" ? PUBLIC_GI_CLIENT_ID : PUBLIC_RESIDENT_GI_CLIENT_ID;

    const adminScopes = [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ];

    const residentScopes = ["openid", "profile", "email"];

    const scopes = (type === "admin" ? adminScopes : residentScopes).join(" ");

    // PKCE Setup
    const verifier = generatePKCEVerifier();
    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("pkce_auth_type", type);
    const challenge = await generatePKCEChallenge(verifier);

    const params = new URLSearchParams({
      client_id: clientId,
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
  <div class="relative z-10 w-full max-w-sm space-y-6">
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

    <div class="animate-in space-y-3 pt-6 duration-1000 fade-in slide-in-from-bottom-4">
      {#if isSigningIn || isLoadingAuth}
        <div
          class="flex h-[116px] animate-in items-center justify-center space-x-3 duration-500 zoom-in-95 fade-in"
        >
          <LoaderIcon class="h-5 w-5 animate-spin text-foreground" />
          {#if isSigningIn}
            <p class="text-sm font-bold tracking-tight text-foreground uppercase">Signing in…</p>
          {/if}
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

  <div
    class="absolute right-0 bottom-12 left-0 flex animate-in flex-col items-center gap-4 text-center duration-1000 fade-in slide-in-from-bottom-2"
  >
    <div class="h-px w-8 bg-border"></div>
    <div class="flex cursor-default items-center gap-2">
      <span class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
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
