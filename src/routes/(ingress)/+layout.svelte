<script lang="ts">
  let { children } = $props();
  import HeroLayout from "$components/branding/HeroLayout.svelte";
  import { page } from "$app/state";

  const isOnboarding = $derived(page.url.pathname === "/onboarding");
</script>

<HeroLayout contentClass={isOnboarding ? "max-w-xl" : "max-w-100"}>
  {@render children()}
</HeroLayout>
