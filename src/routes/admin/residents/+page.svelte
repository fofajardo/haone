<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { type ResidentRecord as Resident } from "$lib/schemas";
  import { mapRowToResident, stageStatusEmailBatch } from "$lib/resident-logic";
  import { goto } from "$app/navigation";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { RefreshCcw, Users, Search, Mail, FunnelX } from "lucide-svelte";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";

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

  async function loadData(forceRefresh = false) {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    try {
      const rows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "accounts!A:AD",
        forceRefresh
      );
      residents = rows
        .slice(1)
        .map((row) => mapRowToResident(row))
        .filter(
          (r) =>
            r.email &&
            r.email !== "_vacant" &&
            (!uiSettings.currentSemester || r.period === uiSettings.currentSemester)
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
      .filter((r) => {
        if (tableSync.filters!.status === "ALL") return true;
        if (tableSync.filters!.status === "FULLY_PAID") return r.isFullyPaid;
        if (tableSync.filters!.status === "PENDING") return !r.isFullyPaid;
        return true;
      });
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
</script>

<Tooltip.Provider>
  <div class="space-y-3">
    <SubpageHeader title="Residents">
      {#snippet actions()}
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
            <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
            <span class="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" disabled={selectedIndices.size === 0} onclick={prepareDispatch}>
            <Mail class="mr-2 h-4 w-4" />
            Send Reminder ({selectedIndices.size})
          </Button>
        </div>
      {/snippet}
    </SubpageHeader>

    {#if isLoading}
      <LoadingView text="Loading resident directory..." />
    {:else if error}
      <ErrorView {error}>
        <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}
          >Try Again</Button
        >
      </ErrorView>
    {:else}
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="lg:col-span-2">
          <TermFilter onSelect={() => loadData()} />
        </div>
        <div class="space-y-1 lg:col-span-5">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
          <div class="relative">
            <Search
              class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={tableSync.filters!.search}
              placeholder="Search by name, email, or room..."
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
            <NativeSelect.Option value="PENDING">Pending</NativeSelect.Option>
          </NativeSelect.Root>
        </div>

        <div class="flex items-end lg:col-span-1">
          <Button
            variant="outline"
            size="sm"
            onclick={resetFilters}
            class="h-10 w-full px-2 text-xs"
          >
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
