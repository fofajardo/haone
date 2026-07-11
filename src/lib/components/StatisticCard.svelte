<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import type { Snippet } from "svelte";

  let {
    title,
    value,
    isLoading = false,
    icon: IconSnippet,
    children
  }: {
    title: string;
    value?: string | number;
    isLoading?: boolean;
    icon?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<Card.Root class="flex flex-col gap-3">
  <Card.Header class="flex flex-row items-center justify-between">
    <Card.Title class="text-sm font-semibold">{title}</Card.Title>
    {#if IconSnippet}
      <div
        class="bg-brand/10 text-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-sm [&>svg]:h-4.5 [&>svg]:w-4.5"
      >
        {@render IconSnippet()}
      </div>
    {/if}
  </Card.Header>
  <Card.Content>
    {#if isLoading}
      <div class="h-9 w-24 animate-pulse rounded bg-muted/50"></div>
    {:else if children}
      {@render children()}
    {:else}
      <p class="text-3xl font-semibold tracking-tight">{value}</p>
    {/if}
  </Card.Content>
</Card.Root>
