<script lang="ts">
  import { page } from "$app/state";
  import { pageState } from "$lib/state/page-info.svelte";
  import { Toaster } from "$lib/components/ui/sonner";
  import { ModeWatcher } from "mode-watcher";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  import { onMount } from "svelte";
  import { auth } from "$lib/state/auth.svelte";
  import { uiSettings } from "$lib/state/settings.svelte";
  import { setMode, resetMode } from "mode-watcher";
  import UIProvider from "$lib/components/UIProvider.svelte";

  let { children } = $props();

  $effect(() => {
    if (page.data.pageInfo?.title) {
      pageState.title = page.data.pageInfo.title;
    }
  });

  onMount(async () => {
    // Service Worker Registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    }

    if (auth.accessToken) {
      try {
        await uiSettings.syncFromServer();
        if (uiSettings.theme === "system") {
          resetMode();
        } else {
          setMode(uiSettings.theme as any);
        }
      } catch (e) {
        console.error("Failed to sync settings:", e);
      }
    }
  });
</script>

<ModeWatcher />
<Toaster mobileOffset="100px" />

<svelte:head>
  <title>{pageState.title ? pageState.title + " - HAOne" : "HAOne"}</title>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<UIProvider class="flex min-h-screen flex-col">
  {@render children()}
</UIProvider>
