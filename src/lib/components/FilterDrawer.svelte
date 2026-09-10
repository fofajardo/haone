<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Drawer from "$ui/drawer";
  import { Button } from "$ui/button";
  import { Funnel, FunnelX } from "@lucide/svelte";

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

  let open = $state(false);
</script>

<!-- Mobile Filter Drawer Trigger -->
<div class="block lg:hidden">
  <Drawer.Root bind:open>
    <div class="flex items-center gap-2">
      <Drawer.Trigger class="flex-1">
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            size="sm"
            class="flex h-9 w-full items-center justify-center gap-2"
          >
            <Funnel class="h-4 w-4" />
            <span>Filter</span>
            {#if activeCount > 0}
              <span
                class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              >
                {activeCount}
              </span>
            {/if}
          </Button>
        {/snippet}
      </Drawer.Trigger>
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
                open = false;
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
