<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title = "No records found.",
    description = "Try adjusting your filters or search query.",
    icon,
    class: className = ""
  }: {
    title?: string;
    description?: string;
    icon?: Snippet;
    class?: string;
  } = $props();
</script>

<div
  class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10 {className}"
>
  {#if icon}
    {@render icon()}
  {/if}
  <div class="text-center">
    <p class="font-semibold text-foreground">{title}</p>
    <p class="text-xs text-muted-foreground">{description}</p>
  </div>
</div>
