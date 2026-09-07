<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Sidebar from "$ui/sidebar";
  import AppSidebar from "$components/nav/AppSidebar.svelte";
  import AppHeader from "$components/nav/AppHeader.svelte";
  import MobileNav from "$components/nav/MobileNav.svelte";
  import { LoaderCircleIcon } from "@lucide/svelte";
  import { page } from "$app/state";
  import { fly, fade } from "svelte/transition";
  import { createHeaderScrollState } from "$utils/scroll.svelte";

  let {
    isLoading = false,
    children
  }: {
    isLoading?: boolean;
    children: Snippet;
  } = $props();

  const scrollState = createHeaderScrollState();
</script>

{#if isLoading}
  <div
    out:fade={{ duration: 250 }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-background"
  >
    <LoaderCircleIcon class="h-5 w-5 animate-spin text-foreground" />
  </div>
{/if}

{#if !isLoading}
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
