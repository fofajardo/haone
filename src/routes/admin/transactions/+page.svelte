<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import {
    fetchJournalEntries,
    batchAuditEntries,
    mapRowToJournal
  } from "$api/controllers/journal-controller";
  import { fetchTransactionTypes, fetchMopTypes } from "$api/controllers/constants-controller";
  import { translateMop } from "$utils/translators";
  import { parseDateWeight } from "$utils/parsers";
  import { Combobox } from "$ui/combobox";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import TermFilter from "$components/TermFilter.svelte";
  import { RefreshCcw, ListFilter, Plus, Search, FunnelX, ShieldCheck } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import { columns } from "./columns";
  import DataTable from "$ui/data-table/data-table.svelte";

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

  async function loadData(forceRefresh = false) {
    isLoading = true;
    error = null;
    selectedIds = new Set();

    try {
      const [entries, types, mops, currentTerm] = await Promise.all([
        fetchJournalEntries(undefined, undefined),
        fetchTransactionTypes(forceRefresh),
        fetchMopTypes(forceRefresh),
        uiSettings.ensureCurrentTerm()
      ]);

      transactionTypes = types;
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
