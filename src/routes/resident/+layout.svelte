<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
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
    <LoaderIcon class="h-5 w-5 animate-spin text-foreground" />
  </div>
{:else}
  <Sidebar.Provider>
    <ResidentSidebar />
    <Sidebar.Inset class="relative flex flex-col overflow-hidden">
      <div
        class="transition-transform duration-300 md:hidden {scrollState.headerHidden
          ? '-translate-y-full'
          : 'translate-y-0'} z-10 shrink-0"
      >
        <AdminHeader />
      </div>
      {#key page.url.pathname}
        <div
          in:fly={{ duration: 200, delay: 80, y: 6, opacity: 0 }}
          out:fly={{ duration: 120, y: -6, opacity: 0 }}
          class="absolute right-0 left-0 overflow-y-auto transition-[top] duration-300 md:top-0 {scrollState.headerHidden
            ? 'top-0'
            : 'top-16'} bottom-20 md:bottom-0"
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
  </Sidebar.Provider>
{/if}
