<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchJournalEntries, batchAuditEntries } from "$api/controllers/journal-controller";
  import { fetchMopTypes } from "$api/controllers/constants-controller";
  import { parseDateWeight } from "$utils/parsers";
  import { Combobox } from "$ui/combobox";
  import { Button } from "$ui/button";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import TermFilter from "$components/TermFilter.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import { RefreshCcw, ListFilter, Search, ShieldCheck, Plus } from "@lucide/svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$ui/data-table/data-table.svelte";
  import AdminTransactionsTabs from "$components/tabs/AdminTransactionsTabs.svelte";
  import { type JournalRecord, TRANSACTION_TYPE_OPTIONS, TransactionType } from "$lib/types";

  let journal = $state<JournalRecord[]>([]);
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

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    selectedIds = new Set();

    try {
      const [entries, mops, currentTerm] = await Promise.all([
        fetchJournalEntries(undefined, undefined, bypassCache),
        fetchMopTypes(bypassCache),
        uiSettings.ensureCurrentTerm()
      ]);

      mopTypes = [{ value: "", label: "N/A" }, ...mops];

      const journals = Array.isArray(entries) ? entries : entries.items;

      const mappedJournal: JournalRecord[] = journals
        .map((res) => ({
          ...res,
          dateWeight: parseDateWeight(res.date)
        }))
        .filter((r) => !currentTerm || r.period === currentTerm)
        .sort(
          (a, b) =>
            (b.dateWeight ?? 0) - (a.dateWeight ?? 0) || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0)
        );

      let globalBalance = 0;
      for (let i = mappedJournal.length - 1; i >= 0; i--) {
        if (mappedJournal[i].type !== TransactionType.WAIVED) {
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
    if (selectedIds.size === 0) {
      return;
    }
    isAuditing = true;
    try {
      await batchAuditEntries(Array.from(selectedIds));
      selectedIds = new Set();
      await loadData(true);
    } catch (e: any) {
      error = `Audit update failed: ${e.message}`;
    } finally {
      isAuditing = false;
    }
  }

  onMount(() => {
    pageState.title = "Transactions";
    loadData();
  });

  const transactionOptions = $derived([
    { value: "ALL", label: "All Types" },
    ...TRANSACTION_TYPE_OPTIONS
  ]);
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

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Transactions"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[{ label: "Add", href: "/admin/transactions/add", icon: Plus }]}
    hasFilter={true}
  >
    {#snippet tabs()}
      <AdminTransactionsTabs active="all" />
    {/snippet}
  </ContentHeader>

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
        Number(tableSync.filters!.type !== "ALL") +
        Number(tableSync.filters!.mop !== "ALL")}
      onClear={resetFilters}
    >
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="lg:col-span-3">
          <TermFilter onSelect={() => loadData()} />
        </div>
        <div class="space-y-1 lg:col-span-5">
          <Label>Search</Label>
          <InputGroup.Root class="h-9 text-sm">
            <InputGroup.Input
              bind:value={tableSync.filters!.search}
              placeholder="Search by name, account, or notes…"
            />
            <InputGroup.Addon>
              <Search />
            </InputGroup.Addon>
          </InputGroup.Root>
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label>Transaction Type</Label>
          <Combobox bind:value={tableSync.filters!.type} options={transactionOptions} class="h-9" />
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label>Payment Processor</Label>
          <Combobox bind:value={tableSync.filters!.mop} options={mopOptions} class="h-9" />
        </div>
      </div>
    </FilterDrawer>

    {#if filteredJournal.length > 0}
      <DataTable
        data={filteredJournal}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
        onSelectionChange={(ids) => (selectedIds = ids)}
        meta={{ TRANSACTION_TYPE_OPTIONS }}
        rowId="id"
        enableSelection
        sorting={[{ id: "date", desc: true }]}
      >
        {#snippet actions()}
          <Button size="sm" onclick={handleBatchAudit} isLoading={isAuditing} icon={ShieldCheck}>
            Mark as Audited
          </Button>
        {/snippet}
      </DataTable>
    {:else}
      <EmptyView>
        {#snippet icon()}
          <ListFilter class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
