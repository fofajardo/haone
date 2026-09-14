<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Label } from "$ui/label";
  import * as Select from "$ui/select";

  let {
    open = $bindable(false),
    newPosition = $bindable(""),
    availablePositions = [],
    isSaving = false,
    onChangePosition,
    onCancel
  }: {
    open: boolean;
    newPosition: string;
    availablePositions: { title: string; limit: number }[];
    isSaving?: boolean;
    onChangePosition: () => void;
    onCancel: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Change Officer Position</Dialog.Title>
      <Dialog.Description>
        Selecting a new position will mark the current record as "Changed Position" and create a new
        active record for this officer.
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label>New Position</Label>
        <Select.Root
          type="single"
          bind:value={newPosition}
          onValueChange={(v) => (newPosition = v)}
        >
          <Select.Trigger class="w-full">
            {newPosition || "Select a new position…"}
          </Select.Trigger>
          <Select.Content>
            {#each availablePositions as pos}
              <Select.Item value={pos.title} label={pos.title}>
                {pos.title}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="ghost" onclick={onCancel}>Cancel</Button>
      <Button onclick={onChangePosition} isLoading={isSaving}>Transition Role</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
