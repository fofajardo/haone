<script lang="ts">
  import { page } from "$app/state";
  import { pageState } from "$lib/page-info.svelte";
  import { ModeWatcher } from "mode-watcher";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();

  $effect(() => {
    if (page.data.pageInfo?.title) {
      pageState.title = page.data.pageInfo.title;
    }
  });
</script>

<ModeWatcher />

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

{@render children()}
