<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { Checkbox } from "$ui/checkbox";
  import { TermCombobox } from "$ui/haone";

  let {
    open = $bindable(false),
    title,
    data = $bindable(),
    isLoading = false,
    submitLabel = "Save",
    onSubmit,
    onCancel
  }: {
    open: boolean;
    title: string;
    data: {
      name: string;
      description: string;
      icon: string;
      extraUrl: string;
      points: number;
      term: string;
      isIndefinite: boolean;
    };
    isLoading?: boolean;
    submitLabel?: string;
    onSubmit: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="grid grid-cols-4 gap-4">
        <div class="space-y-2">
          <Label for="ach-icon">Icon/Emoji</Label>
          <Input id="ach-icon" bind:value={data.icon} />
        </div>
        <div class="col-span-3 space-y-2">
          <Label for="ach-name">Name</Label>
          <Input id="ach-name" bind:value={data.name} />
        </div>
      </div>
      <div class="space-y-2">
        <Label for="ach-desc">Description</Label>
        <Textarea id="ach-desc" bind:value={data.description} />
      </div>
      <div class="space-y-2">
        <Label for="ach-url">Extra URL (optional)</Label>
        <Input id="ach-url" bind:value={data.extraUrl} placeholder="https://..." />
      </div>
      <div class="space-y-2">
        <Label for="ach-points">XP</Label>
        <Input id="ach-points" type="number" min="0" bind:value={data.points} />
      </div>
      <div class="flex items-center space-x-2 py-2">
        <Checkbox id="ach-indefinite" bind:checked={data.isIndefinite} />
        <Label for="ach-indefinite" class="cursor-pointer text-sm leading-none font-medium">
          Indefinite unlocking period
        </Label>
      </div>
      {#if !data.isIndefinite}
        <div class="animate-in space-y-2 duration-200 fade-in-50">
          <TermCombobox bind:value={data.term} />
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel}>Cancel</Button>
      <Button onclick={onSubmit} {isLoading}>{submitLabel}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
