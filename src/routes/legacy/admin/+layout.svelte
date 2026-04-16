<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import AdminSidebar from "$lib/components/admin-sidebar.svelte";
  import AdminHeader from "$lib/components/admin-header.svelte";
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { loadGisScript } from "$lib/gmail";
  import { Button } from "$lib/components/ui/button";
  import { LogIn, Loader2 } from "lucide-svelte";
  import branding from "$lib/branding.json";

  let { children } = $props();
  let isLoading = $state(true);
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

  async function handleLogin() {
    if (!(window as any).google) {
      showError("Connection Error", "Google Identity Services not loaded. Check your connection.");
      return;
    }

    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: (branding.default as any).googleClientId,
        scope: "openid profile email https://www.googleapis.com/auth/gmail.send",
        callback: async (response: any) => {
          if (response.error) {
            showError("Sign-in Failed", response.error_description || response.error);
            return;
          }
          if (response.access_token) {
            try {
              const userInfo = await auth.fetchUserInfo(response.access_token);
              if (!userInfo.email.endsWith("@up.edu.ph")) {
                showError(
                  "Unauthorized Account",
                  "Only UP Mail accounts are authorized to access this console."
                );
                return;
              }
              auth.setSession(response.access_token, userInfo, rememberMe);
            } catch (e: any) {
              showError(
                "Verification Error",
                "Failed to verify account details. Please try again."
              );
            }
          }
        }
      });
      tokenClient.requestAccessToken();
    } catch (e: any) {
      showError("System Error", e.message);
    }
  }
</script>

{#if isLoading}
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <Loader2 class="h-8 w-8 animate-spin text-slate-900" />
  </div>
{:else if !auth.accessToken}
  <div
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white p-6 md:p-12"
  >
    <div class="relative z-10 w-full max-w-sm space-y-4">
      <div class="flex flex-col items-center space-y-8 text-center">
        <!-- Default Branding Logo -->
        <img
          src={branding.default.logoUrl}
          alt={branding.default.logoAlt}
          class="h-28 w-auto object-contain transition-all duration-500 hover:scale-[1.02]"
        />
      </div>

      <div class="animate-in pt-6 duration-1000 fade-in slide-in-from-bottom-4">
        <Button
          onclick={handleLogin}
          class="h-14 w-full rounded-xl bg-slate-900 text-base font-bold text-white transition-all hover:bg-black active:scale-[0.98]"
        >
          <LogIn class="mr-2 h-5 w-5" />
          Sign in with UP Mail
        </Button>
      </div>
    </div>

    <div
      class="absolute right-0 bottom-12 left-0 flex animate-in flex-col items-center gap-4 text-center duration-1000 fade-in slide-in-from-bottom-2"
    >
      <div class="h-px w-8 bg-slate-100"></div>
      <div class="flex cursor-default items-center gap-2">
        <span class="text-[9px] font-bold tracking-widest text-slate-400 uppercase">Powered by</span
        >
        <div class="flex items-center gap-1.5">
          <img src="/ha1.svg" alt="HAOne" class="h-4 w-4" />
          <span class="text-xs font-black tracking-tighter text-slate-800">HAOne</span>
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
          {alertState.description}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Action onclick={() => (alertState.open = false)}>Close</AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{:else}
  <Sidebar.Provider>
    <AdminSidebar />
    <Sidebar.Inset>
      <AdminHeader />
      <main class="font-archivo flex-1 overflow-auto p-4 md:p-8">
        {@render children()}
      </main>
    </Sidebar.Inset>
  </Sidebar.Provider>
{/if}

<style>
  :global(.font-archivo) {
    font-family: "Archivo", sans-serif;
  }
</style>
