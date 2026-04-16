<script lang="ts">
  import type { Snippet } from "svelte";
  import BackButton from "./BackButton.svelte";

  let {
    title = "",
    subtitle = "",
    href = "",
    onBack = undefined,
    actions = undefined,
    titleExtra = undefined
  }: {
    title: string;
    subtitle?: string;
    href?: string;
    onBack?: () => void;
    actions?: Snippet;
    titleExtra?: Snippet;
  } = $props();
</script>

<header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div class="flex items-center gap-4">
    {#if href || onBack}
      <BackButton {href} onclick={onBack} />
    {/if}
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
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
