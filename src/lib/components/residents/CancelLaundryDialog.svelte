<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { Label } from "$ui/label";
  import { Input } from "$ui/input";
  import { Combobox } from "$ui/combobox";
  import { CircleX } from "@lucide/svelte";

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isAdmin?: boolean;
    isCancelling?: boolean;
    onConfirm: (reason: string) => void;
    onCancel?: () => void;
  }

  let {
    open = $bindable(false),
    onOpenChange,
    isAdmin = false,
    isCancelling = false,
    onConfirm,
    onCancel
  }: Props = $props();

  const RESIDENT_REASONS = [
    { value: "In class or academic commitment", label: "In class or academic commitment" },
    { value: "Unavailable or away", label: "Unavailable or away" },
    { value: "Laundry already done", label: "Laundry already done" },
    { value: "Equipment issue", label: "Equipment issue" },
    { value: "Rescheduled to another time", label: "Rescheduled to another time" },
    { value: "CUSTOM", label: "Custom reason…" }
  ];

  const ADMIN_REASONS = [
    { value: "Facility or equipment maintenance", label: "Facility or equipment maintenance" },
    { value: "Water or power outage", label: "Water or power outage" },
    { value: "Dormitory policy violation", label: "Dormitory policy violation" },
    { value: "Duplicate or invalid booking", label: "Duplicate or invalid booking" },
    { value: "Manual administrative override", label: "Manual administrative override" },
    { value: "CUSTOM", label: "Custom reason…" }
  ];

  const reasonOptions = $derived(isAdmin ? ADMIN_REASONS : RESIDENT_REASONS);

  let selectedReason = $state("");
  let customReason = $state("");

  $effect(() => {
    if (open) {
      selectedReason = reasonOptions[0]?.value || "";
      customReason = "";
    }
  });

  function handleClose() {
    if (isCancelling) {
      return;
    }
    open = false;
    onOpenChange?.(false);
    onCancel?.();
  }

  function handleConfirm() {
    let finalReason = selectedReason;
    if (selectedReason === "CUSTOM") {
      finalReason = customReason.trim() || (isAdmin ? "Cancelled by admin" : "Cancelled by user");
    }
    onConfirm(finalReason);
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(nextOpen) => {
    if (!nextOpen && isCancelling) {
      return;
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      onCancel?.();
    }
  }}
>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Cancel Reservation?</Dialog.Title>
      <Dialog.Description>
        {isAdmin
          ? "Please provide a reason for cancellation. This will be visible to the resident."
          : "This action cannot be undone. Please specify a reason for cancellation."}
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4 pb-2">
      <div class="space-y-2">
        <Label class="text-sm">Reason</Label>
        <Combobox
          bind:value={selectedReason}
          options={reasonOptions}
          placeholder="Select a reason..."
          searchPlaceholder="Search reason..."
          class="h-10 text-sm"
        />
      </div>

      {#if selectedReason === "CUSTOM"}
        <div class="space-y-2">
          <Label class="text-sm">Custom Reason</Label>
          <Input
            placeholder="Enter cancellation reason…"
            bind:value={customReason}
            class="h-10 text-sm"
          />
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={handleClose} disabled={isCancelling}>Close</Button>
      <Button onclick={handleConfirm} isLoading={isCancelling} icon={CircleX}>Confirm</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
