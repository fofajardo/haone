<script lang="ts">
  import { brandingState } from "$state/branding.svelte";
  import { cn } from "$utils";

  interface Props {
    class?: string;
    mode?: "light" | "dark" | "auto";
  }
  const { class: className = "h-8 w-auto mx-auto object-contain", mode = "auto" }: Props = $props();
  const baseImgClass = "h-full w-auto object-contain";
  const lightImgClass = $derived(
    cn(baseImgClass, {
      hidden: mode === "dark",
      "dark:hidden": mode === "auto"
    })
  );
  const darkImgClass = $derived(
    cn(baseImgClass, {
      hidden: mode === "light",
      "hidden dark:block": mode === "auto"
    })
  );
</script>

<div class={className}>
  <img
    src={brandingState.profile.logoUrl}
    alt={brandingState.profile.logoAlt}
    class={lightImgClass}
  />
  <img
    src={brandingState.profile.logoUrlDark || brandingState.profile.logoUrl}
    alt={brandingState.profile.logoAlt}
    class={darkImgClass}
  />
</div>
