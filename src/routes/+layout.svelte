<script lang="ts">
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { data, children } = $props();
  const { pageInfo } = $derived(data);
</script>

<svelte:head>
  <title>{pageInfo?.title ? pageInfo.title + " - HAOne" : "HAOne"}</title>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
