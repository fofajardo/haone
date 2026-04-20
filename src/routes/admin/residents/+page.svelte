<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { type ResidentRecord as Resident } from "$lib/schemas";
  import {
    mapRowToResident,
    fetchResidents,
    stageStatusEmailBatch,
    stageClearanceEmailBatch,
    matchesStatusFilter
  } from "$lib/resident-logic";
  import { pluralize } from "$lib/receipt-utils";
  import { goto } from "$app/navigation";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    Users,
    Search,
    Mail,
    FunnelX,
    ChevronDown,
    FileCheck,
    ShieldCheck,
    LoaderCircle
  } from "lucide-svelte";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import ClearanceDialog from "$lib/components/residents/ClearanceDialog.svelte";

  let residents = $state<Resident[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  const tableSync = new TableSync({
    initialFilters: { search: "", room: "ALL", status: "ALL" },
    paramMap: { search: "q", room: "room", status: "status" },
    searchKey: "search"
  });

  // Alias for readability in existing code or keep as tableSync.filters/pagination
  let pagination = $derived.by(() => tableSync.pagination);
  let selectedIndices = $state<Set<string>>(new Set()); // Uses stno as key
  let customReminders = $state("");

  let alertDialog = $state({
    open: false,
    title: "",
    description: "",
    type: "info" as "info" | "error"
  });

  function showAlert(title: string, description: string, type: "info" | "error" = "info") {
    alertDialog = { open: true, title, description, type };
  }

  async function loadData(forceRefresh = false) {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    try {
      residents = await fetchResidents(forceRefresh);
      residents = residents.filter(
        (r) => !uiSettings.currentTerm || r.period === uiSettings.currentTerm
      );
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  const filteredResidents = $derived.by(() => {
    return residents
      .filter((r) => {
        const search = tableSync.filters!.search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(search) ||
          r.email?.toLowerCase().includes(search) ||
          r.room?.toLowerCase().includes(search)
        );
      })
      .filter((r) => tableSync.filters!.room === "ALL" || r.room === tableSync.filters!.room)
      .filter((r) => matchesStatusFilter(r, tableSync.filters!.status));
  });

  const rooms = $derived([
    "ALL",
    ...new Set(
      residents
        .map((r) => r.room)
        .filter(Boolean)
        .sort()
    )
  ]);

  function resetFilters() {
    tableSync.reset();
  }

  function prepareDispatch() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter((r) => selectedIndices.has(r.stno));
    stageStatusEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      customReminders,
      redirect: true
    });
  }

  function prepareClearanceDispatch() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter(
      (r) => selectedIndices.has(r.stno) && r.ceLink && r.ceIssued
    );
    if (selectedResidents.length === 0) {
      showAlert("Dispatch Blocked", "No cleared residents found among the selection.", "error");
      return;
    }
    stageClearanceEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }

  let isClearDialogOpen = $state(false);
  let residentsToClear = $state<Resident[]>([]);

  async function handleBatchClear() {
    if (selectedIndices.size === 0 || !uiSettings.accountingWorkbookId) return;
    const eligible = residents.filter(
      (r) =>
        selectedIndices.has(r.stno) &&
        r.bal <= 0 &&
        r.totalBase > 0 &&
        (!r.ceIssued || r.ceIssued === "" || r.ceIssued === "#N/A")
    );

    if (eligible.length === 0) {
      showAlert(
        "Clearance Blocked",
        "No eligible residents found in the selection (must be fully paid and not yet cleared).",
        "error"
      );
      return;
    }

    residentsToClear = eligible;
    isClearDialogOpen = true;
  }
</script>

<Tooltip.Provider>
  <div class="space-y-3">
    <SubpageHeader title="Residents" isTopLevel={true}>
      {#snippet actions()}
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
            <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
            <span class="hidden sm:inline">Refresh</span>
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger disabled={selectedIndices.size === 0}>
              {#snippet child({ props })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIndices.size === 0}
                  {...props}
                >
                  <Mail class="mr-2 h-4 w-4" />
                  Send
                  <ChevronDown class="ml-2 h-3 w-3 opacity-50" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-56">
              <DropdownMenu.Item onclick={prepareDispatch}>
                <Mail class="mr-2 h-4 w-4" />
                <span>Send Payment Status</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onclick={prepareClearanceDispatch}>
                <FileCheck class="mr-2 h-4 w-4" />
                <span>Send Clearance Certificate</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <Button
            size="sm"
            variant="outline"
            onclick={handleBatchClear}
            disabled={selectedIndices.size === 0}
          >
            <ShieldCheck class="mr-2 h-4 w-4" />
            Mark as Cleared
          </Button>
        </div>
      {/snippet}
    </SubpageHeader>

    {#if isLoading}
      <LoadingView text="Loading resident directory…" />
    {:else if error}
      <ErrorView {error}>
        <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}
          >Try Again</Button
        >
      </ErrorView>
    {:else}
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="lg:col-span-3">
          <TermFilter onSelect={() => loadData()} />
        </div>
        <div class="space-y-1 lg:col-span-4">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
          <div class="relative">
            <Search
              class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={tableSync.filters!.search}
              placeholder="Search by name, email, or room…"
              class="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Room</Label>
          <NativeSelect.Root
            bind:value={tableSync.filters!.room}
            class="h-10 w-full text-xs font-semibold"
          >
            {#each rooms as room}
              <NativeSelect.Option value={room}
                >{room === "ALL" ? "All Rooms" : room}</NativeSelect.Option
              >
            {/each}
          </NativeSelect.Root>
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Payment Status</Label
          >
          <NativeSelect.Root
            bind:value={tableSync.filters!.status}
            class="h-10 w-full text-xs font-semibold"
          >
            <NativeSelect.Option value="ALL">All Statuses</NativeSelect.Option>
            <NativeSelect.Option value="FULLY_PAID">Fully Paid</NativeSelect.Option>
            <NativeSelect.Option value="HALF_FULLY_PAID">Half-Fully Paid</NativeSelect.Option>
            <NativeSelect.Option value="PARTIALLY_PAID">Partially Paid</NativeSelect.Option>
            <NativeSelect.Option value="NO_PAYMENT">No Payment</NativeSelect.Option>
            <NativeSelect.Option value="CLEARED">Cleared</NativeSelect.Option>
          </NativeSelect.Root>
        </div>

        <div class="flex items-end lg:col-span-1">
          <Button variant="outline" size="sm" onclick={resetFilters} class="mb-1 h-9 w-full px-2">
            <FunnelX class="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      {#if filteredResidents.length > 0}
        <DataTable
          data={filteredResidents}
          {columns}
          pagination={tableSync.pagination}
          onPaginationChange={(p) => (tableSync.pagination = p)}
          onRowClick={(r) => goto(`/admin/residents/${r.stno}`)}
          onSelectionChange={(ids) => (selectedIndices = ids)}
          rowId="stno"
          enableSelection
        />
      {:else}
        <div
          class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
        >
          <Users class="h-8 w-8 text-muted-foreground" />
          <div class="text-center">
            <p class="font-semibold text-foreground">No residents found.</p>
            <p class="text-xs text-muted-foreground">Adjust filters or search query.</p>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</Tooltip.Provider>

<ClearanceDialog
  bind:open={isClearDialogOpen}
  residents={residentsToClear}
  allAccounts={residents}
  onSuccess={(count) => {
    showAlert("Success", `${pluralize(count, "resident", "residents")} marked as cleared.`);
    selectedIndices = new Set(); // Clear selection after success
  }}
/>

<AlertDialog.Root open={alertDialog.open} onOpenChange={(v) => (alertDialog.open = v)}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{alertDialog.title}</AlertDialog.Title>
      <AlertDialog.Description>{alertDialog.description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertDialog.open = false)}>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
