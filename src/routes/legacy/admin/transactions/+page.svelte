<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import {
    calculateTotal,
    formatCurrency,
    translatePeriod,
    translateMop,
    formatAmount,
    formatAccounting,
    formatDate,
    parseDateWeight,
    parseCSVAmount
  } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    ListFilter,
    Plus,
    Search,
    FunnelX,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight
  } from "lucide-svelte";
  import type { ReceiptItem } from "$lib/types";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  interface TransactionRecord {
    raw: string[];
    index: number;
    dateWeight: number;
    total: number;
  }

  let journal = $state<JournalRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Filters
  let filterSearch = $state("");
  let filterType = $state("ALL");
  let filterMop = $state("ALL");

  // Sort
  let sortKey = $state("DATE");
  let sortOrder = $state<"asc" | "desc">("desc");

  import { JOURNAL_COL as JOR, type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal, parseAmount } from "$lib/resident-logic";

  async function loadData(forceRefresh = false) {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "journal_general!A:W",
        forceRefresh
      );
      if (rows.length === 0) {
        journal = [];
        return;
      }

      const constRows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
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

      journal = rows
        .slice(1)
        .map((row, idx) => {
          const res = mapRowToJournal(row, idx);
          return {
            ...res,
            dateWeight: parseDateWeight(res.date)
          };
        })
        .filter((r) => !uiSettings.currentSemester || r.period === uiSettings.currentSemester);
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
        const searchStr = (
          (r.name || "") +
          (r.account || "") +
          (r.creatorName || "") +
          (r.notes || "")
        ).toLowerCase();

        const matchSearch = filterSearch === "" || searchStr.includes(filterSearch.toLowerCase());
        const matchSemester =
          !uiSettings.currentSemester || r.period === uiSettings.currentSemester;
        const matchType = filterType === "ALL" || r.type === filterType;
        const matchMop = filterMop === "ALL" || r.mop === filterMop;

        return matchSearch && matchSemester && matchType && matchMop;
      })
      .sort((a, b) => {
        const order = sortOrder === "asc" ? 1 : -1;
        if (sortKey === "DATE") {
          return (
            (a.dateWeight! - b.dateWeight!) * order || (a.ledgerIndex! - b.ledgerIndex!) * order
          );
        }
        if (sortKey === "TOTAL") return (a.amount - b.amount) * order;
        if (sortKey === "ACCOUNT") return (a.name || "").localeCompare(b.name || "") * order;
        if (sortKey === "CREATOR")
          return (a.creatorName || "").localeCompare(b.creatorName || "") * order;
        if (sortKey === "TYPE") return (a.type || "").localeCompare(b.type || "") * order;
        return 0;
      });
  });

  function toggleSort(key: string) {
    if (sortKey === key) sortOrder = sortOrder === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortOrder = "desc";
    }
  }

  function resetFilters() {
    filterSearch = "";
    filterType = "ALL";
    filterMop = "ALL";
  }

  function translateType(val: string) {
    const type = transactionTypes.find((t) => t.value === val);
    return type ? type.label : val;
  }

  function getActiveItems(r: JournalRecord) {
    return [
      { name: "Water Fee", amount: r.water },
      { name: "Association Fee", amount: r.assoc },
      { name: "Misc Fee", amount: r.misc }
    ].filter((i) => i.amount !== 0);
  }
</script>

<div class="space-y-3">
  <SubpageHeader title="Transactions">
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
          <span class="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" href="/legacy/admin/transactions/add">
          <Plus class="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  <div class="grid gap-2 lg:grid-cols-12">
    <div class="lg:col-span-2">
      <TermFilter onSelect={() => loadData()} />
    </div>
    <div class="space-y-1 lg:col-span-5">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
      <div class="relative">
        <Search class="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          bind:value={filterSearch}
          placeholder="Name, account, or notes..."
          class="h-9 pl-9 text-xs"
        />
      </div>
    </div>

    <div class="space-y-1 lg:col-span-2">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Transaction Type</Label>
      <Select.Root type="single" bind:value={filterType}>
        <Select.Trigger class="h-9 w-full min-w-0 px-2 text-xs font-semibold">
          <span class="truncate">
            {filterType === "ALL" ? "All Types" : filterType}
          </span>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">All Types</Select.Item>
          {#each transactionTypes as type}
            <Select.Item value={type.value}>{type.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="space-y-1 lg:col-span-2">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Payment Processor</Label>
      <Select.Root type="single" bind:value={filterMop}>
        <Select.Trigger class="h-9 w-full min-w-0 px-2 text-xs font-semibold">
          <span class="truncate">
            {filterMop === "ALL" ? "All Methods" : translateMop(filterMop)}
          </span>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">All Methods</Select.Item>
          {#each mopTypes as mop}
            <Select.Item value={mop.value}>{mop.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="flex items-end lg:col-span-1">
      <Button variant="outline" size="sm" onclick={resetFilters} class="h-9 w-full px-2 text-xs">
        <FunnelX class="mr-2 h-4 w-4" /> Clear
      </Button>
    </div>
  </div>

  {#if isLoading}
    <LoadingView text="Loading transactions..." />
  {:else if error}
    <div
      class="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-destructive/10 bg-destructive/5"
    >
      <p class="text-sm font-bold text-destructive">{error}</p>
      <Button variant="outline" size="sm" onclick={() => loadData()}>Try Again</Button>
    </div>
  {:else if filteredJournal.length > 0}
    <Card.Root class="overflow-hidden">
      <Card.Content class="p-0">
        <div class="overflow-x-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row class="bg-muted/5">
                <Table.Head class="px-4 py-3"
                  ><button
                    onclick={() => toggleSort("DATE")}
                    class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                    >Date {#if sortKey === "DATE"}{sortOrder === "asc"
                        ? "↑"
                        : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                  ></Table.Head
                >
                <Table.Head class="px-4 py-3">
                  <button
                    onclick={() => toggleSort("CREATOR")}
                    class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                    >Creator {#if sortKey === "CREATOR"}{sortOrder === "asc"
                        ? "↑"
                        : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                  >
                </Table.Head>
                <Table.Head class="px-4 py-3"
                  ><button
                    onclick={() => toggleSort("ACCOUNT")}
                    class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                    >Account {#if sortKey === "ACCOUNT"}{sortOrder === "asc"
                        ? "↑"
                        : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                  ></Table.Head
                >
                <Table.Head class="px-4 py-3">
                  <button
                    onclick={() => toggleSort("TYPE")}
                    class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                    >Type/MOP {#if sortKey === "TYPE"}{sortOrder === "asc"
                        ? "↑"
                        : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                  >
                </Table.Head>
                <Table.Head class="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase"
                  >Notes</Table.Head
                >
                <Table.Head class="px-4 py-3 text-right"
                  ><button
                    onclick={() => toggleSort("TOTAL")}
                    class="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                    >Total {#if sortKey === "TOTAL"}{sortOrder === "asc"
                        ? "↑"
                        : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                  ></Table.Head
                >
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each filteredJournal as record}
                <Table.Row
                  class="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/5"
                  onclick={() => goto(`/legacy/admin/transactions/${record.id || ""}`)}
                >
                  <Table.Cell class="px-4 py-2 align-top text-xs text-slate-500 tabular-nums"
                    >{formatDate(record.date)}</Table.Cell
                  >
                  <Table.Cell class="px-4 py-2 align-top">
                    <div class="flex flex-col">
                      <span class="text-[11px] leading-tight font-bold text-slate-900"
                        >{record.creatorName}</span
                      >
                      <span class="text-[9px] font-medium text-muted-foreground"
                        >{record.creator}</span
                      >
                    </div>
                  </Table.Cell>
                  <Table.Cell class="w-64 px-4 py-2 align-top">
                    <div class="flex flex-col">
                      <span class="text-[11px] leading-tight font-bold text-slate-900"
                        >{record.name}</span
                      >
                      <span class="text-[9px] font-medium text-muted-foreground"
                        >{record.account}</span
                      >
                    </div>
                  </Table.Cell>
                  <Table.Cell class="px-4 py-2 align-top">
                    <div class="flex flex-col">
                      <span class="text-[10px] font-bold tracking-tight text-slate-600 uppercase"
                        >{translateType(record.type)}</span
                      >
                      <span class="text-[9px] text-muted-foreground"
                        >{translateMop(record.mop)}</span
                      >
                    </div>
                  </Table.Cell>
                  <Table.Cell class="max-w-[200px] truncate px-4 py-2 align-top"
                    ><span class="text-[10px] text-slate-600">{record.notes || "—"}</span
                    ></Table.Cell
                  >
                  <Table.Cell class="px-4 py-2 text-right align-top"
                    ><span class="font-mono text-xs font-bold text-slate-900"
                      >{formatAccounting(record.amount)}</span
                    ></Table.Cell
                  >
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </Card.Content>
    </Card.Root>
    <div
      class="flex items-center justify-between px-1 text-[10px] font-medium text-muted-foreground"
    >
      <p>Displaying {filteredJournal.length} of {journal.length} records</p>
    </div>
  {:else}
    <div
      class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
    >
      <ListFilter class="h-8 w-8 text-muted-foreground" />
      <div class="text-center">
        <p class="font-semibold text-slate-900">No records found.</p>
        <p class="text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
      </div>
    </div>
  {/if}
</div>
