<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils";

  let {
    icon: Icon,
    iconClass = "bg-brand/10 text-brand",
    title = "",
    subtitle = "",
    children,
    right,
    href,
    onclick
  }: {
    icon?: any;
    iconClass?: string;
    title?: string;
    subtitle?: string;
    children?: Snippet;
    right?: Snippet;
    href?: string;
    onclick?: () => void;
  } = $props();
</script>

{#snippet content()}
  {#if Icon}
    <div class={cn("shrink-0 rounded-full p-2.5 transition-colors", iconClass)}>
      <Icon class="h-4 w-4" />
    </div>
  {/if}

  <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
    <div class="min-w-0 flex-1">
      {#if title}
        <p class="truncate font-semibold">{title}</p>
      {/if}
      {#if subtitle}
        <p class="text-xs font-semibold text-muted-foreground">{subtitle}</p>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>

    {#if right}
      <div class="shrink-0 text-right">
        {@render right()}
      </div>
    {/if}
  </div>
{/snippet}

{#if href}
  <a
    {href}
    class={cn(
      "group flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 sm:gap-4"
    )}
  >
    {@render content()}
  </a>
{:else if onclick}
  <button
    type="button"
    {onclick}
    class={cn(
      "group flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 sm:gap-4"
    )}
  >
    {@render content()}
  </button>
{:else}
  <div
    class={cn(
      "group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 sm:gap-4"
    )}
  >
    {@render content()}
  </div>
{/if}
