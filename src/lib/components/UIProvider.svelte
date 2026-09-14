<script lang="ts">
  import { settings } from "$state/settings.svelte";
  import type { Snippet } from "svelte";

  let { children, class: className = "" }: { children: Snippet; class?: string } = $props();
</script>

<div
  class="{settings.fontFamily === 'default'
    ? 'font-sans'
    : settings.fontFamily === 'archivo'
      ? 'font-archivo'
      : 'font-shantell'} 
    {settings.reducedMotion ? 'acc-reduced-motion' : ''} 
    {settings.displayDensity !== 'default' ? `acc-density-${settings.displayDensity}` : ''}
    {className}"
>
  {@render children()}
</div>
