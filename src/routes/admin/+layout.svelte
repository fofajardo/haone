<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import AdminSidebar from "$lib/components/admin-sidebar.svelte";
  import AdminHeader from "$lib/components/admin-header.svelte";
  import MobileNav from "$lib/components/mobile-nav.svelte";
  import { auth } from "$lib/auth.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { onMount } from "svelte";
  import { LoaderCircle } from "lucide-svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";

  let { children } = $props();
  let isLoadingAuth = $state(true);
  let alertState = $state({ open: false, title: "", description: "" });

  function showError(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    isLoadingAuth = false;
  });

  // Handle errors from anywhere (e.g., session expired)
  $effect(() => {
    if (auth.lastError) {
      // If we're about to redirect to sign-in due to auth error, 
      // don't clear it here; let sign-in page handle it.
      if (!auth.accessToken) return;

      showError(auth.lastError.title, auth.lastError.description);
      auth.lastError = null;
    }
  });

  // Redirect logic
  $effect(() => {
    const isSignInPage = page.url.pathname === "/sign-in";

    if (!auth.accessToken && !isSignInPage) {
      goto("/sign-in");
    }
  });
</script>

{#if isLoadingAuth}
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <LoaderCircle class="h-8 w-8 animate-spin text-foreground" />
  </div>
{:else if !auth.accessToken && page.url.pathname !== "/sign-in"}
  <!-- Transition state while redirecting -->
  <div class="flex min-h-screen flex-col items-center justify-center gap-4">
    <LoaderCircle class="h-8 w-8 animate-spin text-foreground" />
  </div>
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
      <main class="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">
        {@render children()}
      </main>
      <MobileNav />
    </Sidebar.Inset>
  </Sidebar.Provider>
{/if}

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
