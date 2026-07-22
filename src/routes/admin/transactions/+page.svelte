<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import { uiSettings } from "$lib/state/settings.svelte";
  import { fetchSheetRowsRaw, batchUpdateValues } from "$lib/services/google-sheets-service";
  import { translateMop } from "$lib/utils/translators";
  import { parseDateWeight } from "$lib/utils/parsers";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { RefreshCcw, ListFilter, Plus, Search, FunnelX, ShieldCheck } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";

  let journal = $state<JournalRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let selectedIds = $state<Set<string>>(new Set());
  let isAuditing = $state(false);

  // Filters
  const tableSync = new TableSync({
    initialFilters: { search: "", type: "ALL", mop: "ALL" },
    paramMap: { search: "q", type: "type", mop: "mop" },
    searchKey: "search"
  });

  import { type JournalRecord, JOURNAL_COL as JOR } from "$lib/types";
  import { mapRowToJournal } from "$lib/logic/resident-logic";

  async function loadData(forceRefresh = false) {
    if (!uiSettings.accountingWorkbookId) {
      return;
    }
    isLoading = true;
    error = null;
    selectedIds = new Set();

    try {
      const rows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:T",
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
          const res = mapRowToJournal(row, idx + 2);
          return {
            ...res,
            dateWeight: parseDateWeight(res.date)
          };
        })
        .filter((r) => !uiSettings.currentTerm || r.period === uiSettings.currentTerm)
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

  async function handleBatchAudit() {
    if (selectedIds.size === 0 || !uiSettings.accountingWorkbookId) {
      return;
    }
    isAuditing = true;
    try {
      const rows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:T",
        true
      );
      const updates = Array.from(selectedIds).map((id) => {
        const idx = rows.findIndex((row) => {
          return row[JOR.ID] === id;
        });
        if (idx === -1) {
          throw new Error(`Transaction ${id} not found in the ledger`);
        }
        return {
          range: `journal_general!R${idx + 1}`,
          values: [["TRUE"]]
        };
      });

      await batchUpdateValues(uiSettings.accountingWorkbookId, updates);
      selectedIds = new Set();
      await loadData(true);
    } catch (e: any) {
      error = `Audit update failed: ${e.message}`;
    } finally {
      isAuditing = false;
    }
  }

  onMount(loadData);

  const transactionOptions = $derived([{ value: "ALL", label: "All Types" }, ...transactionTypes]);
  const mopOptions = $derived([{ value: "ALL", label: "All Methods" }, ...mopTypes]);

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
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData(true)}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button
          variant="outline"
          size="sm"
          onclick={handleBatchAudit}
          isLoading={isAuditing}
          icon={ShieldCheck}
          disabled={selectedIds.size === 0}
        >
          Mark as Audited
        </Button>
        <Button size="sm" href="/admin/transactions/add" icon={Plus}>Add</Button>
      </div>
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
            placeholder="Search by name, account, or notes…"
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      <div class="space-y-1 lg:col-span-2">
        <Label>Transaction Type</Label>
        <Combobox bind:value={tableSync.filters!.type} options={transactionOptions} class="h-9" />
      </div>

      <div class="space-y-1 lg:col-span-2">
        <Label>Payment Processor</Label>
        <Combobox bind:value={tableSync.filters!.mop} options={mopOptions} class="h-9" />
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

    {#if filteredJournal.length > 0}
      <DataTable
        data={filteredJournal}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
        onSelectionChange={(ids) => (selectedIds = ids)}
        meta={{ transactionTypes }}
        rowId="id"
        enableSelection
      />
    {:else}
      <EmptyView>
        {#snippet icon()}
          <ListFilter class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
