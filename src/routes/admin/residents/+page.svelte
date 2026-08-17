<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$state/branding.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { type ResidentRecord as Resident } from "$lib/types";
  import {
    fetchResidents,
    stageStatusEmailBatch,
    stageClearanceEmailBatch,
    matchesStatusFilter,
    stageSoaEmailBatch as stageStatementOfAccountEmailBatch
  } from "$api/controllers/resident-controller";
  import { pluralize } from "$utils/formatters";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { Combobox } from "$ui/combobox";

  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import TermFilter from "$components/TermFilter.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import {
    RefreshCcw,
    Users,
    Search,
    Mail,
    FunnelX,
    ChevronDown,
    FileCheck,
    ShieldCheck,
    Trophy
  } from "@lucide/svelte";
  import * as Tooltip from "$ui/tooltip";
  import * as AlertDialog from "$ui/alert-dialog";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$ui/data-table/data-table.svelte";
  import ClearanceDialog from "$components/residents/ClearanceDialog.svelte";
  import AwardDialog from "$components/residents/AwardDialog.svelte";
  import AdminResidentsHeaderActions from "$components/residents/AdminResidentsHeaderActions.svelte";

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

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    try {
      const currentTerm = await uiSettings.ensureCurrentTerm();
      residents = await fetchResidents(bypassCache, currentTerm);
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

  const roomOptions = $derived(
    rooms.map((r) => ({ value: r, label: r === "ALL" ? "All Rooms" : r }))
  );

  const statusOptions = [
    { value: "ALL", label: "All Statuses" },
    { value: "FULLY_PAID", label: "Fully Paid" },
    { value: "HALF_FULLY_PAID", label: "Half-Fully Paid" },
    { value: "PARTIALLY_PAID", label: "Partially Paid" },
    { value: "NO_PAYMENT", label: "No Payment" },
    { value: "CLEARED", label: "Cleared" }
  ];

  function resetFilters() {
    tableSync.reset();
  }

  function prepareDispatchForStatementOfAccount() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter((r) => selectedIndices.has(r.stno));
    stageStatementOfAccountEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      customReminders,
      redirect: true
    });
  }

  function prepareDispatchForPaymentStatus() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter((r) => selectedIndices.has(r.stno));
    stageStatusEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      customReminders,
      redirect: true
    });
  }

  function prepareDispatchForClearance() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter(
      (r) =>
        selectedIndices.has(r.stno) &&
        r.ceLink &&
        r.ceLink !== "N/A" &&
        r.ceLink !== "" &&
        r.ceIssued
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
  let isAwardDialogOpen = $state(false);
  let residentsToAward = $state<Resident[]>([]);

  async function handleBatchClear() {
    if (selectedIndices.size === 0) {
      return;
    }
    const eligible = residents.filter((r) => {
      return (
        selectedIndices.has(r.stno) &&
        r.bal <= 0 &&
        r.totalBase > 0 &&
        (!r.ceIssued || r.ceIssued === "" || r.ceIssued === "#N/A")
      );
    });

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

  function handleBatchAward() {
    if (selectedIndices.size === 0) {
      return;
    }
    residentsToAward = residents.filter((r) => {
      return selectedIndices.has(r.stno);
    });
    isAwardDialogOpen = true;
  }
</script>

<Tooltip.Provider>
  <div class="mx-auto max-w-7xl space-y-3">
    <SubpageHeader
      title="Residents"
      isTopLevel={true}
      onRefresh={() => loadData(true)}
      isRefreshing={isLoading}
    >
      {#snippet actions()}
        <AdminResidentsHeaderActions active="list" />
      {/snippet}
    </SubpageHeader>

    {#if isLoading}
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
      <FilterDrawer
        activeCount={Number(tableSync.filters!.search !== "") +
          Number(tableSync.filters!.room !== "ALL") +
          Number(tableSync.filters!.status !== "ALL")}
      >
        <div class="grid gap-2 lg:grid-cols-12">
          <div class="lg:col-span-3">
            <TermFilter onSelect={() => loadData()} />
          </div>
          <div class="space-y-1 lg:col-span-4">
            <Label>Search</Label>
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
            <Label>Room</Label>
            <Combobox bind:value={tableSync.filters!.room} options={roomOptions} class="h-9" />
          </div>

          <div class="space-y-1 lg:col-span-2">
            <Label>Payment Status</Label>
            <Combobox bind:value={tableSync.filters!.status} options={statusOptions} class="h-9" />
          </div>

          <div class="flex items-end lg:col-span-1">
            <Button
              variant="outline"
              size="sm"
              onclick={resetFilters}
              class="h-9 w-full px-2"
              icon={FunnelX}
            >
              Clear
            </Button>
          </div>
        </div>
      </FilterDrawer>

      {#if filteredResidents.length > 0}
        <DataTable
          data={filteredResidents}
          {columns}
          pagination={tableSync.pagination}
          onPaginationChange={(p) => (tableSync.pagination = p)}
          onRowClick={(r) => goto(`/admin/users/${r.residentId}?term=${r.period}`)}
          onSelectionChange={(ids) => (selectedIndices = ids)}
          rowId="stno"
          enableSelection
          sorting={[{ id: "name", desc: false }]}
        >
          {#snippet actions()}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button variant="outline" size="sm" {...props} icon={Mail}>
                    Send
                    <ChevronDown class="ml-2 h-3 w-3 opacity-50" />
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" class="w-56">
                <DropdownMenu.Item onclick={prepareDispatchForStatementOfAccount}>
                  <Mail class="mr-2 h-4 w-4" />
                  <span>Send Statement of Account</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={prepareDispatchForPaymentStatus}>
                  <Mail class="mr-2 h-4 w-4" />
                  <span>Send Payment Status</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={prepareDispatchForClearance}>
                  <FileCheck class="mr-2 h-4 w-4" />
                  <span>Send Clearance Certificate</span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <Button variant="outline" size="sm" onclick={handleBatchAward} icon={Trophy}>
              Award
            </Button>

            <Button size="sm" onclick={handleBatchClear} icon={ShieldCheck}>Mark as Cleared</Button>
          {/snippet}
        </DataTable>
      {:else}
        <EmptyView
          title="No residents found."
          description="Try adjusting your filters or search query."
        >
          {#snippet icon()}
            <Users class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
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

<AwardDialog
  bind:open={isAwardDialogOpen}
  residents={residentsToAward}
  onSuccess={(count) => {
    selectedIndices = new Set();
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
