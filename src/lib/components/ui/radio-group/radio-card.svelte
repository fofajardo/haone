<script lang="ts">
  import { Label } from "$ui/label";
  import * as RadioGroup from "$ui/radio-group";
  import type { Component } from "svelte";
  import { cn } from "$lib/utils";

  interface Props {
    value: string;
    id?: string;
    title: string;
    description?: string;
    icon?: Component<any>;
    selected?: boolean;
    disabled?: boolean;
    class?: string;
  }

  let {
    value,
    id,
    title,
    description,
    icon: Icon,
    selected = false,
    disabled = false,
    class: className
  }: Props = $props();

  const itemId = $derived(id || `radio-card-${value}`);
</script>

<Label
  for={itemId}
  class={cn(
    "relative flex items-start justify-between gap-3 rounded-xl border-2 p-4 transition-all sm:flex-col sm:justify-start sm:gap-0",
    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
    disabled && "pointer-events-none cursor-not-allowed opacity-50",
    className
  )}
>
  <div class="flex items-start gap-3 sm:w-full sm:items-center sm:justify-between">
    {#if Icon}
      <Icon class={cn("mt-0.5 h-5 w-5 shrink-0 sm:mt-0", "text-primary")} />
    {/if}
    <div class="block sm:hidden">
      <p class={cn("text-sm font-bold", "text-primary")}>
        {title}
      </p>
      {#if description}
        <p class="mt-0.5 text-xs font-normal text-foreground">
          {description}
        </p>
      {/if}
    </div>
  </div>

  <div class="hidden sm:mt-3 sm:block">
    <p class={cn("text-sm font-bold", "text-primary")}>
      {title}
    </p>
    {#if description}
      <p class="mt-0.5 text-xs font-normal text-foreground">
        {description}
      </p>
    {/if}
  </div>

  <RadioGroup.Item
    {value}
    id={itemId}
    {disabled}
    class="mt-0.5 shrink-0 sm:absolute sm:top-4 sm:right-4 sm:mt-0"
  />
</Label>
