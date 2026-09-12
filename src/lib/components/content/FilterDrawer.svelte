<script lang="ts">
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";
  import * as Drawer from "$ui/drawer";
  import { Button } from "$ui/button";
  import { FunnelX } from "@lucide/svelte";
  import { filterState } from "$state/page-info.svelte";

  let {
    children,
    activeCount = 0,
    onClear
  }: {
    children: Snippet;
    title?: string;
    activeCount?: number;
    onClear?: () => void;
  } = $props();

  $effect(() => {
    filterState.activeCount = activeCount;
  });

  onDestroy(() => {
    filterState.open = false;
    filterState.activeCount = 0;
  });
</script>

<!-- Mobile Filter Drawer (Trigger lives in ContentHeader) -->
<div class="block lg:hidden">
  <Drawer.Root bind:open={filterState.open}>
    <Drawer.Content class="max-h-[85vh]">
      <Drawer.Header>
        <div class="flex items-center justify-between">
          <Drawer.Title>Filter</Drawer.Title>
          {#if onClear && activeCount > 0}
            <Button
              variant="secondary"
              size="sm"
              onclick={() => {
                onClear();
                filterState.open = false;
              }}
              class="h-8 px-2 text-xs"
              icon={FunnelX}
            >
              Clear
            </Button>
          {/if}
        </div>
      </Drawer.Header>
      <div class="space-y-4 overflow-y-auto px-4 pb-6">
        {@render children()}
      </div>
    </Drawer.Content>
  </Drawer.Root>
</div>

<!-- Desktop: Render as-is, but hide labels -->
<div
  class="hidden lg:block [&_:not(.flex)>label]:hidden [&_:not(.space-x-2)>label:not([class*='cursor-pointer'])]:hidden"
>
  <div class="flex items-end gap-2">
    <div class="flex-1">
      {@render children()}
    </div>
    {#if onClear && activeCount > 0}
      <Button
        variant="outline"
        size="sm"
        onclick={onClear}
        class="h-9 shrink-0 px-3"
        icon={FunnelX}
      >
        Clear
      </Button>
    {/if}
  </div>
</div>
