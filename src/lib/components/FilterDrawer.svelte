<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Drawer from "$ui/drawer";
  import { Button } from "$ui/button";
  import { Funnel } from "@lucide/svelte";

  let {
    children,
    activeCount = 0
  }: {
    children: Snippet;
    title?: string;
    activeCount?: number;
  } = $props();

  let open = $state(false);
</script>

<!-- Mobile Filter Drawer Trigger -->
<div class="block lg:hidden">
  <Drawer.Root bind:open>
    <Drawer.Trigger>
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
    <Drawer.Content class="max-h-[85vh]">
      <Drawer.Header>
        <Drawer.Title>Filter</Drawer.Title>
      </Drawer.Header>
      <div class="space-y-4 overflow-y-auto px-4 pb-6">
        {@render children()}
      </div>
    </Drawer.Content>
  </Drawer.Root>
</div>

<!-- Desktop: Render as-is directly in page flow -->
<div class="hidden lg:block">
  {@render children()}
</div>
