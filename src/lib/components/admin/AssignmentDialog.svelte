<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Label } from "$lib/components/ui/label";
  import { Combobox } from "$lib/components/ui/combobox";
  import { manualAssignBed, manualDelistResident } from "$lib/rooms-logic.svelte";
  import { toast } from "svelte-sonner";
  import { Info, TriangleAlert } from "@lucide/svelte";

  let {
    open = $bindable(false),
    room,
    bed = $bindable(""),
    userId = $bindable(""),
    isOccupied,
    activeTerm,
    userOptions,
    availableBedOptions,
    onSuccess
  }: {
    open: boolean;
    room: string;
    bed: string;
    userId: string;
    isOccupied: boolean;
    activeTerm: string;
    userOptions: { value: string; label: string }[];
    availableBedOptions: { value: string; label: string }[];
    onSuccess: () => Promise<void>;
  } = $props();

  let delist = $state(false);
  let delistReason = $state("regular_checkout");
  let waiveBalance = $state(true);
  let isLoading = $state(false);

  const reasonOptions = [
    { value: "regular_checkout", label: "Regular checkout" },
    { value: "early_checkout", label: "Early check-out" },
    { value: "loa", label: "Leave of Absence" },
    { value: "transferred", label: "Transferred to another residence hall" },
    { value: "deceased", label: "Deceased" },
    { value: "remove", label: "Remove account completely" }
  ];

  $effect(() => {
    if (open) {
      delist = isOccupied;
      delistReason = "regular_checkout";
      waiveBalance = true;
    }
  });

  async function handleConfirm() {
    if (!userId || !bed) return;
    isLoading = true;
    try {
      if (delist) {
        await manualDelistResident(userId, activeTerm, delistReason as any, waiveBalance);
        toast.success("Resident delisted.");
      } else {
        await manualAssignBed(userId, room, bed, activeTerm);
        toast.success("Bed assignment updated.");
      }
      open = false;
      await onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Operation failed.");
    } finally {
      isLoading = false;
    }
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {delist ? "Delist Resident" : "Assign Resident"}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {#if delist}
          Configure delisting for the resident in Room <strong>{room}</strong>, Bed
          <strong>{bed}</strong>.
        {:else}
          Assign a resident to Room <strong>{room}</strong>{#if bed}
            , Bed <strong>{bed}</strong>{/if}.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <div class="space-y-4 pb-4">
      {#if delist}
        <div class="animate-in space-y-2 duration-200 fade-in slide-in-from-top-1">
          <Label>Reason</Label>
          <Combobox
            bind:value={delistReason}
            options={reasonOptions}
            placeholder="Select a reason…"
            class="w-full"
          />

          {#if delistReason === "regular_checkout"}
            <div
              class="flex animate-in items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground duration-200 fade-in slide-in-from-top-1"
            >
              <Info class="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p class="mb-1 font-bold tracking-wider uppercase">Notice</p>
                Regular checkout residents do not need to be delisted.
              </div>
            </div>
          {/if}

          {#if delistReason === "remove"}
            <div
              class="flex animate-in items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground duration-200 fade-in slide-in-from-top-1"
            >
              <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p class="mb-1 font-bold tracking-wider uppercase">Irreversible Action</p>
                This will permanently delete the resident's active account record for this term. Their
                transaction history and balances for this semester will be unlinked.
              </div>
            </div>
          {/if}

          {#if delistReason === "early_checkout" || delistReason === "loa" || delistReason === "deceased" || delistReason === "transferred"}
            <div class="flex animate-in items-center space-x-2 py-1 duration-200 fade-in">
              <Checkbox id="waiveBalance" bind:checked={waiveBalance} />
              <Label for="waiveBalance" class="cursor-pointer">Waive remaining balance</Label>
            </div>

            {#if waiveBalance}
              <div
                class="flex animate-in items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground duration-200 fade-in slide-in-from-top-1"
              >
                <Info class="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p class="mb-1 font-bold tracking-wider uppercase">Remaining Balance Waived</p>
                  This will automatically create a waived transaction for the resident's remaining balance
                  for this term.
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {:else}
        {#if !bed}
          <div class="space-y-2">
            <Label>Select Bed</Label>
            <Combobox
              bind:value={bed}
              options={availableBedOptions}
              placeholder="Select a bed…"
              class="w-full"
            />
          </div>
        {/if}

        <div class="space-y-2">
          <Label>Resident</Label>
          <Combobox
            bind:value={userId}
            options={userOptions}
            placeholder="Search for a resident…"
            class="w-full"
          />
        </div>
      {/if}
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isLoading}>Cancel</AlertDialog.Cancel>
      {#if delist}
        <AlertDialog.Action
          onclick={handleConfirm}
          disabled={!userId || !delistReason || delistReason === "regular_checkout" || isLoading}
        >
          {isLoading ? "Saving…" : "Confirm"}
        </AlertDialog.Action>
      {:else}
        <AlertDialog.Action onclick={handleConfirm} disabled={!userId || !bed || isLoading}>
          {isLoading ? "Saving…" : "Confirm"}
        </AlertDialog.Action>
      {/if}
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
