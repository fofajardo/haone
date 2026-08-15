<script lang="ts">
  import type { Snippet } from "svelte";
  import BackButton from "./BackButton.svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";

  let {
    title = "",
    subtitle = "",
    href = "",
    onBack = undefined,
    onRefresh = undefined,
    isRefreshing = false,
    actions = undefined,
    titleExtra = undefined,
    isTopLevel = false
  }: {
    title: string;
    subtitle?: string;
    href?: string;
    onBack?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    actions?: Snippet;
    titleExtra?: Snippet;
    isTopLevel?: boolean;
  } = $props();
</script>

<header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  <div class="flex items-center gap-4">
    {#if !isTopLevel}
      <BackButton {href} onclick={onBack} />
    {/if}
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <h1 class="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {#if onRefresh}
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-foreground"
            onclick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCcw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
            <span class="sr-only">Refresh</span>
          </Button>
        {/if}
        {#if titleExtra}
          {@render titleExtra()}
        {/if}
      </div>
      {#if subtitle}
        <p class="text-sm text-muted-foreground">{subtitle}</p>
      {/if}
    </div>
  </div>
  {#if actions}
    <div class="flex items-center gap-3">
      {@render actions()}
    </div>
  {/if}
</header>
