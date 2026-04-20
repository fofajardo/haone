<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { translateMop, parseDateWeight } from "$lib/receipt-utils";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { RefreshCcw, ListFilter, Plus, Search, FunnelX } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";

  let journal = $state<JournalRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Filters
  const tableSync = new TableSync({
    initialFilters: { search: "", type: "ALL", mop: "ALL" },
    paramMap: { search: "q", type: "type", mop: "mop" },
    searchKey: "search"
  });

  import { type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal } from "$lib/resident-logic";

  async function loadData(forceRefresh = false) {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:W",
        forceRefresh
      );
      if (rows.length === 0) {
        journal = [];
        return;
      }

      const constRows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "constants!A:C",
        forceRefresh
      );

      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));

      mopTypes = [
        { value: "", label: "N/A" },
        ...constRows
          .slice(1)
          .filter((r) => (r[0] || "").startsWith("MOP_"))
          .map((r) => ({
            value: r[1] || r[0],
            label: translateMop(r[1] || r[0])
          }))
      ];

      const mappedJournal: JournalRecord[] = rows
        .slice(1)
        .map((row, idx) => {
          const res = mapRowToJournal(row, idx);
          return {
            ...res,
            dateWeight: parseDateWeight(res.date)
          };
        })
        .filter((r) => !uiSettings.currentSemester || r.period === uiSettings.currentSemester)
        .sort(
          (a, b) =>
            (b.dateWeight ?? 0) - (a.dateWeight ?? 0) || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0)
        );

      let globalBalance = 0;
      for (let i = mappedJournal.length - 1; i >= 0; i--) {
        if (!mappedJournal[i].type.toUpperCase().includes("WAIVED")) {
          globalBalance += mappedJournal[i].amount;
        }
        mappedJournal[i].runningBalance = globalBalance;
      }

      journal = mappedJournal;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  const filteredJournal = $derived.by(() => {
    return journal
      .filter((r) => {
        const search = tableSync.filters!.search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(search) ||
          r.account?.toLowerCase().includes(search) ||
          r.notes?.toLowerCase().includes(search) ||
          r.mopRefNo?.toLowerCase().includes(search)
        );
      })
      .filter((r) => tableSync.filters!.type === "ALL" || r.type === tableSync.filters!.type)
      .filter((r) => tableSync.filters!.mop === "ALL" || r.mop === tableSync.filters!.mop);
  });

  function resetFilters() {
    tableSync.reset();
  }
</script>

<div class="space-y-3">
  <SubpageHeader title="Transactions" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
          <span class="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" href="/admin/transactions/add">
          <Plus class="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading transactions…" />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}>Try Again</Button>
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
            placeholder="Name, account, or notes…"
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      <div class="space-y-1 lg:col-span-2">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Transaction Type</Label
        >
        <NativeSelect.Root
          bind:value={tableSync.filters!.type}
          class="h-10 w-full text-xs font-semibold"
        >
          <NativeSelect.Option value="ALL">All Types</NativeSelect.Option>
          {#each transactionTypes as type}
            <NativeSelect.Option value={type.value}>{type.label}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </div>

      <div class="space-y-1 lg:col-span-2">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase"
          >Payment Processor</Label
        >
        <NativeSelect.Root
          bind:value={tableSync.filters!.mop}
          class="h-10 w-full text-xs font-semibold"
        >
          <NativeSelect.Option value="ALL">All Methods</NativeSelect.Option>
          {#each mopTypes as mop}
            <NativeSelect.Option value={mop.value}>{mop.label}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </div>

      <div class="flex items-end lg:col-span-1">
        <Button variant="outline" size="sm" onclick={resetFilters} class="mb-1 h-9 w-full px-2">
          <FunnelX class="mr-2 h-4 w-4" /> Clear
        </Button>
      </div>
    </div>

    {#if filteredJournal.length > 0}
      <DataTable
        data={filteredJournal}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
        meta={{ transactionTypes }}
        rowId="id"
      />
    {:else}
      <div
        class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
      >
        <ListFilter class="h-8 w-8 text-muted-foreground" />
        <div class="text-center">
          <p class="font-semibold text-foreground">No records found.</p>
          <p class="text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
        </div>
      </div>
    {/if}
  {/if}
</div>
