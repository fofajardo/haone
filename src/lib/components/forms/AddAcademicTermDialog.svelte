<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Plus } from "@lucide/svelte";

  let {
    open = $bindable(false),
    newStartYear = $bindable(new Date().getFullYear()),
    newTerm = $bindable("1S"),
    termOptions,
    errorMessage = "",
    isSaving = false,
    onAdd,
    onCancel
  }: {
    open: boolean;
    newStartYear: number;
    newTerm: string;
    termOptions: { value: string; label: string }[];
    errorMessage?: string;
    isSaving?: boolean;
    onAdd: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add New Academic Term</Dialog.Title>
      <Dialog.Description>
        This will create a new semester code and append it to the constants sheet.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 pb-4">
      {#if errorMessage}
        <div class="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {errorMessage}
        </div>
      {/if}

      <div class="space-y-2">
        <Label for="startYear">Academic Year Start</Label>
        <div class="flex items-center gap-3">
          <Input
            id="startYear"
            type="number"
            bind:value={newStartYear}
            min="2020"
            max="2100"
            class="flex-1"
          />
          <span class="text-sm text-muted-foreground">to {newStartYear + 1}</span>
        </div>
      </div>

      <div class="space-y-2">
        <Label>Term Type</Label>
        <Combobox bind:value={newTerm} options={termOptions} class="w-full" />
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={onCancel} disabled={isSaving}>Cancel</Button>
      <Button onclick={onAdd} isLoading={isSaving} icon={Plus}>Create</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
