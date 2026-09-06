<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import AdminSidebar from "$components/admin-sidebar.svelte";
  import AdminHeader from "$components/admin-header.svelte";
  import MobileNav from "$components/mobile-nav.svelte";
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
  <Sidebar.Provider>
    <AdminSidebar />
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
