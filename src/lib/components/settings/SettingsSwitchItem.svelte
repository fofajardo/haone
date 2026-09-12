<script lang="ts">
  import { Label } from "$ui/label";
  import { Switch } from "$ui/switch";
  import type { Component } from "svelte";

  let {
    id,
    title,
    description,
    icon: Icon,
    checked = $bindable(false),
    disabled = false,
    onCheckedChange
  }: {
    id?: string;
    title: string;
    description?: string;
    icon?: Component<{ class?: string }>;
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } = $props();
</script>

<div class="flex items-center justify-between space-x-4">
  <div class="flex items-center gap-4">
    {#if Icon}
      <div class="rounded-xl bg-brand/10 p-2 text-brand">
        <Icon class="h-5 w-5" />
      </div>
    {/if}
    <div class="space-y-0.5">
      <Label for={id}>{title}</Label>
      {#if description}
        <p class="text-sm text-muted-foreground">
          {description}
        </p>
      {/if}
    </div>
  </div>
  <Switch {id} bind:checked {disabled} {onCheckedChange} />
</div>
