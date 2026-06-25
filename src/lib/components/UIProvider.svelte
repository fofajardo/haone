<script lang="ts">
  import { uiSettings } from "$lib/settings.svelte";
  import type { Snippet } from "svelte";

  let { children, class: className = "" }: { children: Snippet; class?: string } = $props();
</script>

<div
  class="{uiSettings.fontFamily === 'default'
    ? 'font-sans'
    : uiSettings.fontFamily === 'archivo'
      ? 'font-archivo'
      : 'font-shantell'} 
    {uiSettings.reducedMotion ? 'acc-reduced-motion' : ''} 
    {uiSettings.displayDensity !== 'default' ? `acc-density-${uiSettings.displayDensity}` : ''}
    {className}"
>
  {@render children()}
</div>
