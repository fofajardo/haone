<script lang="ts">
  import { brandingState } from "$lib/branding.svelte";

  interface Props {
    class?: string;
  }
  const { class: className = "h-8 w-auto mx-auto object-contain" }: Props = $props();
</script>

<div class={className}>
  <img
    src={brandingState.profile.logoUrl}
    alt={brandingState.profile.logoAlt}
    class="h-full w-auto object-contain dark:hidden"
  />
  <img
    src={brandingState.profile.logoUrlDark || brandingState.profile.logoUrl}
    alt={brandingState.profile.logoAlt}
    class="hidden h-full w-auto object-contain dark:block"
  />
</div>
