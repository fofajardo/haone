<script lang="ts">
  import { CircleAlert } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  let {
    error,
    class: className = "",
    children
  }: {
    error: string;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div
  class="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/10 bg-destructive/5 p-8 text-center {className}"
>
  <CircleAlert class="h-8 w-8 text-destructive opacity-50" />
  <p class="text-sm font-bold text-destructive">{error}</p>
  {#if children}
    {@render children()}
  {/if}
</div>
