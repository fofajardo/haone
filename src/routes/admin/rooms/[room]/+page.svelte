<script lang="ts">
  import { roomsState } from "$lib/rooms.svelte";
  import { fetchResidents, fetchUsers, fetchTermCurr } from "$lib/resident-logic";
  import { manualAssignBed } from "$lib/rooms-logic.svelte";
  import type { ResidentRecord, UserRecord } from "$lib/schemas";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { RefreshCcw, Users, Bed, Info } from "lucide-svelte";

  let { data } = $props();
  const roomNumber = $derived(data.roomNumber);

  let residents = $state<ResidentRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let activeTerm = $state("");

  $effect(() => {
    loadData();
  });

  async function loadData(forceRefresh = false) {
    isLoading = true;
    error = null;
    try {
      const [resData, userData, term] = await Promise.all([
        fetchResidents(forceRefresh),
        fetchUsers(forceRefresh),
        fetchTermCurr(forceRefresh)
      ]);
      activeTerm = term;
      if (!activeTerm) {
        throw new Error("Active academic term (TERM_CURR) not found in constants.");
      }
      residents = resData.filter((r) => r.period === activeTerm && r.room === roomNumber);
      users = userData;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  const roomConfig = $derived(roomsState.config.find((r) => r.room_number === roomNumber));

  const occupancyMap = $derived.by(() => {
    const map = new Map<string, ResidentRecord>();
    residents.forEach((r) => {
      if (r.bed) {
        map.set(r.bed, r);
      }
    });
    return map;
  });

  const residentsNoBed = $derived(residents.filter((r) => !r.bed));

  const userOptions = $derived(
    users.map((u) => ({
      value: u.id,
      label: `${u.displayName} (${u.studentNo || u.email})`
    }))
  );

  const availableBedOptions = $derived(
    roomConfig
      ? roomConfig.slots
          .filter((slot) => !occupancyMap.has(slot))
          .map((slot) => ({ value: slot, label: `Bed ${slot}` }))
      : []
  );

  let alertDialog = $state({
    open: false,
    title: "",
    description: "",
    type: "info" as "info" | "error"
  });

  function showAlert(title: string, description: string, type: "info" | "error" = "info") {
    alertDialog = { open: true, title, description, type };
  }

  let assignmentDialog = $state({
    open: false,
    bed: "",
    userId: ""
  });

  function openAssign(bed: string, currentRes?: ResidentRecord) {
    assignmentDialog = {
      open: true,
      bed,
      userId: currentRes?.residentId || ""
    };
  }

  async function confirmAssign() {
    if (!assignmentDialog.userId || !assignmentDialog.bed) return;
    isLoading = true;
    try {
      await manualAssignBed(assignmentDialog.userId, roomNumber, assignmentDialog.bed, activeTerm);
      showAlert("Success", "Bed assignment updated.");
      assignmentDialog.open = false;
      await loadData(true);
    } catch (e: any) {
      showAlert("Assignment Failed", e.message, "error");
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="space-y-4">
  <SubpageHeader title="Room {roomNumber}" isTopLevel={false}>
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => loadData(true)}
        {isLoading}
        icon={RefreshCcw}
      >
        Refresh
      </Button>
    {/snippet}
  </SubpageHeader>

  {#if isLoading && residents.length === 0}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        onclick={() => loadData()}
        {isLoading}
        icon={RefreshCcw}>Try Again</Button
      >
    </ErrorView>
  {:else if !roomConfig}
    <ErrorView error="Room configuration not found." />
  {:else}
    <div class="grid gap-6 lg:grid-cols-3">
      <Card.Root class="lg:col-span-2">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <Bed class="h-5 w-5" />
            Bed Assignments
          </Card.Title>
          <Card.Description>Manage assignments for each slot in this room.</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="grid gap-4 sm:grid-cols-2">
            {#each roomConfig.slots as slot}
              {@const resident = occupancyMap.get(slot)}
              {@const isSlotAvailable =
                roomConfig.available_slots.includes(slot) && !roomConfig.unavailable_reason}

              <div
                class="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 {resident
                  ? 'bg-primary/5'
                  : 'bg-muted/20'}"
              >
                <div class="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-bold text-muted-foreground sm:text-base"
                  >
                    {slot}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold sm:text-base">
                      {resident ? resident.name : "Available"}
                    </p>
                    <p class="truncate text-xs text-muted-foreground">
                      {resident ? resident.stno || resident.email : "No assignment"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full sm:w-auto"
                  onclick={() => openAssign(slot, resident)}
                  disabled={!isSlotAvailable && !resident}
                >
                  {resident ? "Change" : "Assign"}
                </Button>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>

      <div class="space-y-6">
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <Info class="h-5 w-5" />
              Room Info
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Total Slots</span>
              <span class="font-bold">{roomConfig.slots.length}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Occupied Beds</span>
              <span class="font-bold">{occupancyMap.size}</span>
            </div>
            {#if roomConfig.unavailable_reason}
              <div class="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <p class="mb-1 font-bold uppercase">Unavailable</p>
                {roomConfig.unavailable_reason}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        {#if residentsNoBed.length > 0}
          <Card.Root class="border-primary/20 bg-primary/5">
            <Card.Header>
              <Card.Title class="flex items-center gap-2 text-lg">
                <Users class="h-5 w-5" />
                In-Room (No Bed)
              </Card.Title>
              <Card.Description>Residents assigned to this room but no bed yet.</Card.Description>
            </Card.Header>
            <Card.Content class="space-y-2">
              {#each residentsNoBed as res}
                <div
                  class="flex items-center justify-between rounded-lg border bg-background p-2 text-sm"
                >
                  <span class="mr-2 flex-1 truncate font-medium">{res.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs"
                    onclick={() => openAssign("", res)}
                  >
                    Pick Bed
                  </Button>
                </div>
              {/each}
            </Card.Content>
          </Card.Root>
        {/if}
      </div>
    </div>
  {/if}
</div>

<AlertDialog.Root bind:open={assignmentDialog.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Assign Resident</AlertDialog.Title>
      <AlertDialog.Description>
        Assign a resident to Room <strong>{roomNumber}</strong>{#if assignmentDialog.bed}
          , Bed <strong>{assignmentDialog.bed}</strong>{/if}.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <div class="space-y-4 pb-4">
      {#if !assignmentDialog.bed}
        <div class="space-y-2">
          <Label>Select Bed</Label>
          <Combobox
            bind:value={assignmentDialog.bed}
            options={availableBedOptions}
            placeholder="Select a bed…"
            class="w-full"
          />
        </div>
      {/if}
      <div class="space-y-2">
        <Label>Resident</Label>
        <Combobox
          bind:value={assignmentDialog.userId}
          options={userOptions}
          placeholder="Search for a resident…"
          class="w-full"
        />
      </div>
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={confirmAssign}
        disabled={!assignmentDialog.userId || !assignmentDialog.bed}
      >
        Assign Bed
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={alertDialog.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class={alertDialog.type === "error" ? "text-destructive" : ""}>
        {alertDialog.title}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {alertDialog.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertDialog.open = false)}>OK</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
