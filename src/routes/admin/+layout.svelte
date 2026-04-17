<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import AdminSidebar from "$lib/components/admin-sidebar.svelte";
  import AdminHeader from "$lib/components/admin-header.svelte";
  import { auth } from "$lib/auth.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { onMount } from "svelte";
  import { loadGisScript } from "$lib/gmail";
  import { testAccess } from "$lib/google-sheets";
  import { Button } from "$lib/components/ui/button";
  import { LogIn, LoaderCircle } from "lucide-svelte";
  import { setMode } from "mode-watcher";
  import branding from "$lib/branding.json";

  let { children } = $props();
  let isLoading = $state(true);
  let isLoggingIn = $state(false);
  let rememberMe = $state(true);

  let alertState = $state({ open: false, title: "", description: "" });

  function showError(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    try {
      await loadGisScript();
    } catch (e) {
      console.error("Failed to load GIS script", e);
    } finally {
      isLoading = false;
    }
  });

  $effect(() => {
    if (auth.lastError) {
      showError(auth.lastError.title, auth.lastError.description);
      auth.lastError = null;
    }
  });

  async function handleLogin() {
    if (!(window as any).google) {
      showError("Connection Error", "Google Identity Services not loaded. Check your connection.");
      return;
    }

    isLoggingIn = true;
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: (branding.default as any).googleClientId,
        scope:
          "openid profile email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/spreadsheets",
        callback: async (response: any) => {
          if (response.error) {
            isLoggingIn = false;
            showError("Sign-in Failed", response.error_description || response.error);
            return;
          }
          if (response.access_token) {
            try {
              const userInfo = await auth.fetchUserInfo(response.access_token);
              const spreadsheetId = (branding.default as any).spreadsheetId;
              await testAccess(spreadsheetId, response.access_token);
              auth.setSession(response.access_token, userInfo, rememberMe);
            } catch (e: any) {
              isLoggingIn = false;
            }
          } else {
            isLoggingIn = false;
          }
        }
      });
      tokenClient.requestAccessToken();
    } catch (e: any) {
      isLoggingIn = false;
      showError("System Error", e.message);
    }
  }
</script>

{#if isLoading}
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <LoaderCircle class="h-8 w-8 animate-spin text-foreground" />
  </div>
{:else if !auth.accessToken}
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
        <!-- Default Branding Logo -->
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
          disabled={isLoggingIn}
          class="h-14 w-full rounded-xl bg-foreground text-base font-bold text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {#if isLoggingIn}
            <LoaderCircle class="mr-2 h-5 w-5 animate-spin" />
            Signing in...
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
{:else}
  <Sidebar.Provider
    class="{uiSettings.fontFamily === 'inter'
      ? 'font-sans'
      : uiSettings.fontFamily === 'archivo'
        ? 'font-archivo'
        : 'font-shantell'} 
      {uiSettings.reducedMotion ? 'acc-reduced-motion' : ''} 
      {uiSettings.displayDensity !== 'default' ? `acc-density-${uiSettings.displayDensity}` : ''}"
  >
    <AdminSidebar />
    <Sidebar.Inset>
      <AdminHeader />
      <main class="flex-1 overflow-auto p-4 md:p-8">
        {@render children()}
      </main>
    </Sidebar.Inset>
  </Sidebar.Provider>
{/if}

<style>
  :global(.font-archivo) {
    font-family: "Archivo", sans-serif;
  }
  :global(.font-shantell) {
    font-family: "Shantell Sans", cursive;
  }

  /* Accessibility Global Overrides */
  :global(.acc-reduced-motion *) {
    transition: none !important;
    animation: none !important;
  }

  /* Density Scaling - Only applies for non-default density */
  :global(.acc-density-compact) {
    --density-spacing: 0.6;
    --density-line-height: 1.25;
    --density-radius: 0.5;
  }
  :global(.acc-density-comfortable) {
    --density-spacing: 1.5;
    --density-line-height: 2;
    --density-radius: 1.5;
  }

  :global([class*="acc-density-"] *) {
    line-height: var(--density-line-height) !important;
  }

  /* Global Radius Scaling */
  :global([class*="acc-density-"] .rounded-xl),
  :global([class*="acc-density-"] [data-slot="card"]) {
    border-radius: calc(0.75rem * var(--density-radius)) !important;
  }
  :global([class*="acc-density-"] .rounded-2xl) {
    border-radius: calc(1rem * var(--density-radius)) !important;
  }

  /* Target common UI components */
  :global([class*="acc-density-"] [data-slot="card-header"]),
  :global([class*="acc-density-"] [data-slot="card-content"]),
  :global([class*="acc-density-"] [data-slot="card-footer"]) {
    padding-top: calc(1.5rem * var(--density-spacing)) !important;
    padding-bottom: calc(1.5rem * var(--density-spacing)) !important;
  }

  /* Sidebar scaling - Vertical Density */
  :global([class*="acc-density-"] [data-slot="sidebar-menu-button"]) {
    height: calc(2.25rem * var(--density-spacing)) !important;
    padding-top: calc(0.5rem * var(--density-spacing)) !important;
    padding-bottom: calc(0.5rem * var(--density-spacing)) !important;
  }
  :global([class*="acc-density-"] [data-slot="sidebar-group"]) {
    gap: calc(0.5rem * var(--density-spacing)) !important;
  }

  /* Button scaling */
  :global([class*="acc-density-"] .inline-flex.h-9),
  :global([class*="acc-density-"] .inline-flex.h-10) {
    height: calc(2.5rem * var(--density-spacing)) !important;
    padding-left: calc(1rem * var(--density-spacing)) !important;
    padding-right: calc(1rem * var(--density-spacing)) !important;
  }

  /* Horizontal scaling for cards */
  :global(.acc-density-compact [data-slot*="card-"]) {
    padding-left: 1rem !important;
    padding-right: 1rem !important;
  }
  :global(.acc-density-comfortable [data-slot*="card-"]) {
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }

  /* Global Gap Overrides */
  :global(.acc-density-compact .gap-6) {
    gap: 0.75rem !important;
  }
  :global(.acc-density-comfortable .gap-6) {
    gap: 2.25rem !important;
  }
</style>
