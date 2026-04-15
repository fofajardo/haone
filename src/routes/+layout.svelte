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
</svelte:head>

{@render children()}
