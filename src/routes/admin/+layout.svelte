<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import AppSidebar from "$components/nav/AppSidebar.svelte";
  import AppHeader from "$components/nav/AppHeader.svelte";
  import MobileNav from "$components/nav/MobileNav.svelte";
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { LoaderIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { fly } from "svelte/transition";
  import { createHeaderScrollState } from "$utils/scroll.svelte";
  import { globalDialog } from "$state/dialog.svelte";

  let { children } = $props();
  let isLoadingAuth = $state(true);

  const scrollState = createHeaderScrollState();

  onMount(async () => {
    isLoadingAuth = false;
    if (auth.accessToken && auth.user?.email && !auth.adminDisplayName) {
      try {
        const { fetchUsers } = await import("$api/controllers/resident-controller");
        const users = await fetchUsers();
        const found = users.find((u) => {
          return u.email.toLowerCase() === auth.user!.email.toLowerCase();
        });
        if (found && found.displayName) {
          auth.setAdminDisplayName(found.displayName);
        }
      } catch (err) {
        console.error("Failed to fetch admin display name:", err);
      }
    }
  });

  // Redirect logic
  $effect(() => {
    if (auth.accessToken) {
      if (auth.authType !== "admin") {
        if (auth.isInstanceAdmin) {
          auth.logout();
          auth.redirectTo = page.url.pathname + page.url.search;
          globalDialog.show(
            "Access Denied",
            "Instance administrator accounts must sign in as a House Council Officer."
          );
          goto("/sign-in");
          return;
        }
        goto("/resident");
      }
      return;
    }

    // Save path for restoration
    auth.redirectTo = page.url.pathname + page.url.search;
    goto("/sign-in");
  });
</script>

{#if isLoadingAuth || (!auth.accessToken && page.url.pathname !== "/sign-in") || auth.authType !== "admin"}
  <div class="flex min-h-screen items-center justify-center">
    <LoaderIcon class="h-5 w-5 animate-spin text-foreground" />
  </div>
{:else}
  <Sidebar.Provider class="h-svh w-full overflow-hidden">
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
      <Sidebar.Inset class="relative flex flex-col overflow-hidden">
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
