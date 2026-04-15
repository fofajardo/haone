<script lang="ts">
  import { page } from "$app/state";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
  const pageInfo = $derived(page.data.pageInfo);
</script>

<svelte:head>
  <title>{pageInfo?.title ? pageInfo.title + " - HAOne" : "HAOne"}</title>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
