<script lang="ts">
  import { type Column } from "@tanstack/table-core";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils";

  let {
    column,
    title,
    class: className
  }: {
    column: Column<any, any>;
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
