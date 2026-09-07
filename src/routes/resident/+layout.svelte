<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import AppSidebar from "$components/nav/AppSidebar.svelte";
  import AppHeader from "$components/nav/AppHeader.svelte";
  import MobileNav from "$components/nav/MobileNav.svelte";
  import { auth } from "$state/auth.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { onMount } from "svelte";
  import { LoaderCircleIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { fly } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { isResidentRouteAllowed } from "$api/controllers/resident-controller";

  import { createHeaderScrollState } from "$utils/scroll.svelte";

  let { children } = $props();
  let isLoadingAuth = $state(true);

  const scrollState = createHeaderScrollState();

  onMount(async () => {
    isLoadingAuth = false;
    if (auth.accessToken) {
      await residentState.refresh();
    }
  });

  // Redirect logic
  $effect(() => {
    const pathname = page.url.pathname as string;
    const isSignInPage = pathname === "/sign-in";

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
        if (residentState.needsOnboarding) {
          goto("/onboarding");
          return;
        }

        const accountType =
          residentState.status?.account?.type || residentState.status?.currEntry?.accountType || "";
        const room = residentState.status?.account?.room || "";
        if (!isResidentRouteAllowed(pathname, accountType, room)) {
          goto("/resident");
          return;
        }
      }
    }
  });
</script>

{#if isLoadingAuth || (auth.accessToken && !residentState.status) || (!auth.accessToken && page.url.pathname !== "/sign-in")}
  <div class="flex min-h-screen items-center justify-center">
    <LoaderCircleIcon class="h-5 w-5 animate-spin text-foreground" />
  </div>
{:else}
  <Sidebar.Provider class="h-svh w-full overflow-hidden bg-sidebar">
    <div
      class="fixed inset-x-0 top-0 z-20 h-16 transition-transform duration-300 ease-in-out {scrollState.headerHidden
        ? '-translate-y-full'
        : 'translate-y-0'}"
    >
      <AppHeader />
    </div>
    <div
      class="absolute inset-x-0 bottom-0 flex overflow-hidden transition-[top] duration-300 ease-in-out {scrollState.headerHidden
        ? 'top-0'
        : 'top-16'}"
    >
      <AppSidebar />
      <Sidebar.Inset class="relative flex flex-col overflow-hidden md:rounded-tl-4xl">
        {#key page.url.pathname}
          <div
            in:fly={{ duration: 200, delay: 80, y: 6, opacity: 0 }}
            out:fly={{ duration: 120, y: -6, opacity: 0 }}
            class="absolute inset-0 bottom-20 overflow-y-auto md:bottom-0"
            onscroll={scrollState.handleScroll}
          >
            <main class="p-4 md:p-8">
              {@render children()}
            </main>
          </div>
        {/key}
        <!-- Flex spacer pushes nav to bottom of screen flow -->
        <div class="flex-1"></div>
        <MobileNav />
      </Sidebar.Inset>
    </div>
  </Sidebar.Provider>
{/if}
