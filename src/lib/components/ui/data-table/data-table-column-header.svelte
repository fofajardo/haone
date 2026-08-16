<script lang="ts">
  import { ArrowUpDown } from "@lucide/svelte";
  import { Button } from "$ui/button/index.js";
  import { cn } from "$lib/utils";

  let {
    column,
    title,
    class: className
  }: {
    column: {
      getCanSort: () => boolean;
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (desc?: boolean, isMulti?: boolean) => void;
      [key: string]: any;
    };
    title: string;
    class?: string;
  } = $props();

  function toggleSort() {
    column.toggleSorting(column.getIsSorted() === "asc");
  }
</script>

{#if column.getCanSort()}
  <Button
    variant="ghost"
    size="sm"
    class={cn(
      "-ml-3 flex h-10 items-center gap-1.5 text-sm font-medium text-foreground",
      className
    )}
    onclick={toggleSort}
  >
    <span>{title}</span>
    {#if column.getIsSorted() === "asc"}
      <span class="text-foreground">↑</span>
    {:else if column.getIsSorted() === "desc"}
      <span class="text-foreground">↓</span>
    {:else}
      <ArrowUpDown class="h-4 w-4 opacity-50" />
    {/if}
  </Button>
{:else}
  <span class={cn("text-sm font-medium text-foreground", className)}>{title}</span>
{/if}
