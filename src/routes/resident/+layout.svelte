<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import * as AlertDialog from "$ui/alert-dialog";
  import ResidentSidebar from "$components/resident-sidebar.svelte";
  import AdminHeader from "$components/admin-header.svelte";
  import MobileNav from "$components/mobile-nav.svelte";
  import { auth } from "$state/auth.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { onMount } from "svelte";
  import { LoaderIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { fly } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { isResidentRouteAllowed } from "$api/controllers/resident-controller";

  import { createHeaderScrollState } from "$utils/scroll.svelte";

  let { children } = $props();
  let isLoadingAuth = $state(true);
  let alertState = $state({ open: false, title: "", description: "" });

  const scrollState = createHeaderScrollState();

  function showError(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    isLoadingAuth = false;
    if (auth.accessToken) {
      await residentState.refresh();
    }
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
    const pathname = page.url.pathname as string;
    const isSignInPage = pathname === "/sign-in";
    const isOnboardingPage = pathname === "/resident/onboarding";

    if (!auth.accessToken && !isSignInPage) {
      auth.redirectTo = page.url.pathname + page.url.search;
      goto("/sign-in");
      return;
    }

    if (auth.accessToken) {
      if (auth.isInstanceAdmin && pathname.startsWith("/resident")) {
        goto("/admin");
        return;
      }

      if (residentState.status) {
        if (residentState.needsOnboarding && !isOnboardingPage) {
          goto("/resident/onboarding");
          return;
        } else if (!residentState.needsOnboarding && isOnboardingPage) {
          goto("/resident");
          return;
        }

        const accountType =
          residentState.status?.account?.type || residentState.status?.currEntry?.accountType || "";
        const room = residentState.status?.account?.room || "";
        if (!isOnboardingPage && !isResidentRouteAllowed(pathname, accountType, room)) {
          goto("/resident");
          return;
        }
      }
    }
  });
</script>

{#if isLoadingAuth || (auth.accessToken && !residentState.status) || (!auth.accessToken && page.url.pathname !== "/sign-in")}
  <div class="flex min-h-screen items-center justify-center">
    <LoaderIcon class="h-5 w-5 animate-spin text-foreground" />
  </div>
{:else}
  <Sidebar.Provider>
    {#if !residentState.needsOnboarding}
      <ResidentSidebar />
    {/if}
    <Sidebar.Inset class="relative flex flex-col overflow-hidden">
      <div
        class="transition-transform duration-300 md:hidden {scrollState.headerHidden
          ? '-translate-y-full'
          : 'translate-y-0'} z-10 shrink-0"
      >
        <AdminHeader hideToggle={residentState.needsOnboarding} />
      </div>
      {#key page.url.pathname}
        <div
          in:fly={{ duration: 200, delay: 80, y: 6, opacity: 0 }}
          out:fly={{ duration: 120, y: -6, opacity: 0 }}
          class="absolute right-0 left-0 overflow-y-auto transition-[top] duration-300 md:top-0 {scrollState.headerHidden
            ? 'top-0'
            : 'top-16'} {residentState.needsOnboarding ? 'bottom-0' : 'bottom-20 md:bottom-0'}"
          onscroll={scrollState.handleScroll}
        >
          <main class={residentState.needsOnboarding ? "p-4 pb-12 md:p-6 md:pb-6" : "p-4 md:p-8"}>
            {@render children()}
          </main>
        </div>
      {/key}
      <!-- Flex spacer pushes nav to bottom of screen flow -->
      <div class="flex-1"></div>
      {#if !residentState.needsOnboarding}
        <MobileNav />
      {/if}
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
