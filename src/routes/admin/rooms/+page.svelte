<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { roomsState } from "$state/rooms.svelte";
  import { fetchResidents, fetchUsers } from "$api/controllers/resident-controller";
  import { fetchTermCurr } from "$api/controllers/constants-controller";
  import {
    getSyncPreview,
    applySync,
    type SyncPreviewAction
  } from "$api/controllers/rooms-controller.svelte";
  import type { ResidentRecord, UserRecord } from "$lib/types";
  import { pluralize } from "$utils/formatters";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Combobox } from "$ui/combobox";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import * as Card from "$ui/card";
  import * as Tooltip from "$ui/tooltip";
  import * as AlertDialog from "$ui/alert-dialog";
  import AssignmentDialog from "$components/admin/AssignmentDialog.svelte";
  import {
    RefreshCcw,
    User,
    Users,
    Bed,
    CloudDownload,
    CircleCheck,
    CircleAlert,
    ExternalLink,
    ShieldCheck,
    ChevronRight,
    MoveRight
  } from "@lucide/svelte";

  let residents = $state<ResidentRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(false);
  let isSyncing = $state(false);
  let error = $state<string | null>(null);
  let activeTerm = $state("");

  let selectedUnit = $state("ALL");
  let isCompact = $state(true);
  let previewActions = $state<SyncPreviewAction[]>([]);
  let showPreview = $state(false);
  let selectedGroups = $state<Set<number>>(new Set());

  const groupedPreview = $derived.by(() => {
    const groups = new Map<number, SyncPreviewAction[]>();
    for (const action of previewActions) {
      const key = action.currIndex ?? -1;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(action);
    }
    return Array.from(groups.entries()).map(([currIndex, actions]) => ({ currIndex, actions }));
  });

  const selectedActions = $derived(
    previewActions.filter((a) => selectedGroups.has(a.currIndex ?? -1))
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

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const [resData, userData, currentTerm] = await Promise.all([
        fetchResidents(bypassCache),
        fetchUsers(bypassCache),
        fetchTermCurr(bypassCache)
      ]);
      activeTerm = currentTerm;
      if (!activeTerm) {
        throw new Error("Active academic term (TERM_CURR) not found in constants.");
      }
      residents = resData.filter((r) => r.period === activeTerm);
      users = userData;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => loadData());

  const occupancyMap = $derived.by(() => {
    const map = new Map<string, ResidentRecord>();
    residents.forEach((r) => {
      if (r.room && r.bed) {
        map.set(`${r.room}-${r.bed}`, r);
      }
    });
    return map;
  });

  const unassignedResidents = $derived(residents.filter((r) => !r.room));

  function getRoomOccupancy(roomNumber: string) {
    return residents.filter((r) => r.room === roomNumber).length;
  }

  function getResidentsNoBed(roomNumber: string) {
    return residents.filter((r) => r.room === roomNumber && !r.bed);
  }

  const userOptions = $derived(
    users.map((u) => ({
      value: u.id,
      label: `${u.displayName} (${u.studentNo || u.email})`
    }))
  );

  const currentRoom = $derived(
    roomsState.config.find((r) => r.room_number === assignmentDialog.room)
  );

  const availableBedOptions = $derived(
    currentRoom
      ? currentRoom.slots
          .filter((slot) => !occupancyMap.has(`${assignmentDialog.room}-${slot}`))
          .map((slot) => ({ value: slot, label: `Bed ${slot}` }))
      : []
  );

  const unitOptions = $derived.by(() => {
    const units = new Set<string>();
    roomsState.config.forEach((r) => {
      units.add(roomsState.getUnit(r.room_number));
    });
    return Array.from(units).sort();
  });

  const filteredRooms = $derived(
    roomsState.config.filter(
      (r) => selectedUnit === "ALL" || roomsState.getUnit(r.room_number) === selectedUnit
    )
  );

  async function handleSync() {
    if (!activeTerm) {
      showAlert("Term Required", "Active academic term (TERM_CURR) not found.", "error");
      return;
    }
    isSyncing = true;
    try {
      previewActions = await getSyncPreview(activeTerm);
      if (previewActions.length === 0) {
        showAlert("Sync", "All records are already up to date.");
      } else {
        // Pre-select all groups by default
        selectedGroups = new Set(previewActions.map((a) => a.currIndex ?? -1));
        showPreview = true;
      }
    } catch (e: any) {
      showAlert("Sync Failed", e.message || "An error occurred.", "error");
    } finally {
      isSyncing = false;
    }
  }

  async function confirmSync() {
    isSyncing = true;
    showPreview = false;
    try {
      const result = await applySync(selectedActions, activeTerm);
      showAlert(
        "Sync Complete",
        `${pluralize(result.usersCreated, "user profile", "user profiles")} and ${pluralize(result.accountsCreated, "assignment", "assignments")} created. ${pluralize(result.usersUpdated, "user profile", "user profiles")} and ${pluralize(result.accountsUpdated, "assignment", "assignments")} updated. Evaluated ${pluralize(result.evaluated || 0, "registration", "registrations")}.`
      );
      await loadData(true);
    } catch (e: any) {
      showAlert("Sync Failed", e.message || "An error occurred.", "error");
    } finally {
      isSyncing = false;
    }
  }

  let assignmentDialog = $state({
    open: false,
    room: "",
    bed: "",
    userId: "",
    isOccupied: false
  });

  function openAssign(room: string, bed: string, currentRes?: ResidentRecord) {
    assignmentDialog = {
      open: true,
      room,
      bed,
      userId: currentRes?.residentId || "",
      isOccupied: !!currentRes
    };
  }
</script>

<div class="space-y-4">
  <SubpageHeader title="Rooms" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData(true)}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button
          size="sm"
          onclick={handleSync}
          isLoading={isSyncing}
          disabled={isLoading}
          icon={CloudDownload}
        >
          Sync
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  <div class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="space-y-1">
      <Label>Unit</Label>
      <Combobox
        bind:value={selectedUnit}
        options={[
          { value: "ALL", label: "All Units" },
          ...unitOptions.map((u) => ({ value: u, label: `Unit ${u}` }))
        ]}
        placeholder="Filter by Unit"
        class="h-9"
      />
    </div>
    <div class="flex items-center gap-2 pb-2">
      <Checkbox id="compact-view" bind:checked={isCompact} />
      <Label
        for="compact-view"
        class="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Compact View
      </Label>
    </div>
  </div>

  {#if unassignedResidents.length > 0}
    <Card.Root class="border-destructive/20 bg-destructive/5">
      <Card.Header class="p-4">
        <div class="flex items-center gap-2 text-destructive">
          <CircleAlert class="h-5 w-5" />
          <Card.Title class="text-base font-bold"
            >Unassigned Residents ({unassignedResidents.length})</Card.Title
          >
        </div>
        <Card.Description
          >Residents for the current term without a room assignment.</Card.Description
        >
      </Card.Header>
      <Card.Content class="p-4 pt-0">
        <div class="flex flex-wrap gap-2">
          {#each unassignedResidents as res}
            <Badge variant="outline" class="bg-background">
              {res.name} ({res.stno || res.email})
            </Badge>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

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
  {:else}
    <div
      class={isCompact
        ? "flex flex-col gap-2"
        : "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"}
    >
      {#each filteredRooms as room}
        {#if isCompact}
          <button
            onclick={() => goto(`/admin/rooms/${room.room_number}`)}
            class="group flex w-full items-center gap-3 rounded-xl border bg-muted/30 p-3 text-left transition-all hover:bg-muted/50 {room.unavailable_reason
              ? 'opacity-60 grayscale'
              : ''}"
          >
            <div class="rounded-lg bg-muted p-2 text-muted-foreground">
              {#if room.slots.every((slot) => occupancyMap.has(`${room.room_number}-${slot}`))}
                <ShieldCheck class="h-5 w-5 text-primary" />
              {:else}
                {@const occupancy = getRoomOccupancy(room.room_number)}
                {#if occupancy > 0}
                  <Users class="h-5 w-5 text-muted-foreground" />
                {:else}
                  <Bed class="h-5 w-5" />
                {/if}
              {/if}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <p
                  class="text-base font-bold text-foreground transition-colors group-hover:text-primary"
                >
                  {room.room_number}
                </p>
                {#if room.unavailable_reason}
                  <span class="text-xs font-bold text-destructive uppercase">
                    {room.unavailable_reason}
                  </span>
                {:else}
                  <Badge variant="outline" class="text-xs uppercase">
                    {getRoomOccupancy(room.room_number)} Occupied
                  </Badge>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-1">
              <ChevronRight
                class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"
              />
            </div>
          </button>
        {:else}
          <Card.Root
            class="overflow-hidden p-0 {room.unavailable_reason ? 'opacity-60 grayscale' : ''}"
          >
            <Card.Header class="bg-muted/50 p-3">
              <div class="flex items-center justify-between">
                <a
                  href="/admin/rooms/{room.room_number}"
                  class="group/title flex items-center gap-1.5 transition-colors hover:text-primary"
                >
                  <Card.Title class="text-lg font-bold">{room.room_number}</Card.Title>
                  <ExternalLink
                    class="h-3 w-3 opacity-0 transition-opacity group-hover/title:opacity-100"
                  />
                </a>
                {#if room.unavailable_reason}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <CircleAlert class="h-4 w-4 text-destructive" />
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p class="text-xs">{room.unavailable_reason}</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                {:else}
                  <Badge variant="outline" class="text-xs uppercase">
                    {getRoomOccupancy(room.room_number)} Occupied
                  </Badge>
                {/if}
              </div>
            </Card.Header>
            {#if !isCompact}
              <Card.Content class="p-3">
                <div class="grid grid-cols-2 gap-2">
                  {#each room.slots as slot}
                    {@const key = `${room.room_number}-${slot}`}
                    {@const resident = occupancyMap.get(key.toUpperCase())}
                    {@const isSlotAvailable =
                      room.available_slots.includes(slot) && !room.unavailable_reason}
                    <button
                      class="group relative flex flex-col items-center justify-center rounded-xl border border-dashed p-2 transition-all hover:bg-muted/50 {resident
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-muted-foreground/30'} {!isSlotAvailable && !resident
                        ? 'cursor-not-allowed opacity-40 grayscale'
                        : ''}"
                      onclick={() =>
                        (isSlotAvailable || !!resident) &&
                        openAssign(room.room_number, slot, resident)}
                      disabled={!isSlotAvailable && !resident}
                    >
                      <div class="flex w-full items-center justify-between">
                        <span class="text-xs font-bold text-muted-foreground">{slot}</span>
                        {#if resident}
                          <CircleCheck class="h-3 w-3 text-primary" />
                        {/if}
                      </div>
                      <div class="my-1">
                        {#if resident}
                          <User class="h-5 w-5 text-primary" />
                        {:else}
                          <Bed class="h-5 w-5 text-muted-foreground/40" />
                        {/if}
                      </div>
                      <span class="w-full truncate text-center text-xs font-medium">
                        {resident ? resident.name : "Available"}
                      </span>
                    </button>
                  {/each}
                </div>

                {#if getResidentsNoBed(room.room_number).length > 0}
                  <div class="mt-3 space-y-1">
                    <p class="text-xs font-bold text-muted-foreground uppercase">No Bed Assigned</p>
                    {#each getResidentsNoBed(room.room_number) as res}
                      <button
                        class="transition-hover flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-1.5 text-left text-xs hover:bg-muted/50"
                        onclick={() => openAssign(room.room_number, "", res)}
                      >
                        <User class="h-3 w-3 text-muted-foreground" />
                        <span class="truncate font-medium">{res.name}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </Card.Content>
            {/if}
          </Card.Root>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<AssignmentDialog
  bind:open={assignmentDialog.open}
  room={assignmentDialog.room}
  bind:bed={assignmentDialog.bed}
  bind:userId={assignmentDialog.userId}
  isOccupied={assignmentDialog.isOccupied}
  {activeTerm}
  {userOptions}
  {availableBedOptions}
  onSuccess={() => loadData(true)}
/>

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

<AlertDialog.Root bind:open={showPreview}>
  <AlertDialog.Content class="max-w-3xl">
    <AlertDialog.Header>
      <AlertDialog.Title>Sync Preview</AlertDialog.Title>
      <AlertDialog.Description>
        Select the registration groups to apply. Uncheck any you want to skip.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <div class="max-h-[60vh] overflow-auto py-4 pr-1">
      <div class="space-y-3">
        {#each groupedPreview as group}
          {@const isChecked = selectedGroups.has(group.currIndex)}
          {@const primaryAction = group.actions[0]}
          <div
            class="rounded-xl border transition-colors {isChecked
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-muted/20 opacity-60'}"
          >
            <div class="flex items-start gap-3 p-3">
              <Checkbox
                id={`group-${group.currIndex}`}
                checked={isChecked}
                onCheckedChange={(v) => {
                  const next = new Set(selectedGroups);
                  if (v) {
                    next.add(group.currIndex);
                  } else {
                    next.delete(group.currIndex);
                  }
                  selectedGroups = next;
                }}
                class="mt-0.5"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-bold text-foreground">{primaryAction.residentName}</p>
                  <p class="text-xs text-muted-foreground">
                    {primaryAction.studentNo || primaryAction.email}
                  </p>
                </div>
                <div class="mt-2 space-y-1.5">
                  {#each group.actions as action}
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant={action.type.startsWith("CREATE") ? "default" : "outline"}
                        class="shrink-0 text-xs font-bold tracking-tighter uppercase"
                      >
                        {action.type.replace("_", " ")}
                      </Badge>
                      <span class="text-muted-foreground">{action.details}</span>
                      {#if action.from}
                        <Badge variant="secondary" class="bg-muted text-xs font-bold">
                          {action.from}
                        </Badge>
                      {/if}
                      {#if action.from && action.to}
                        <MoveRight class="h-3 w-3 text-muted-foreground" />
                      {/if}
                      {#if action.to}
                        <Badge
                          variant="secondary"
                          class="bg-primary/10 text-xs font-bold text-primary"
                        >
                          {action.to}
                        </Badge>
                      {/if}
                    </div>
                    {#if action.warning}
                      <p
                        class="flex items-center gap-1 text-xs font-bold text-destructive uppercase"
                      >
                        <CircleAlert class="h-3 w-3" />
                        {action.warning}
                      </p>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={confirmSync} disabled={selectedGroups.size === 0}>
        Apply Selected ({selectedGroups.size} of {groupedPreview.length})
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
