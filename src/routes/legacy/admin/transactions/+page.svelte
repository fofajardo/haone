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
    Loader2,
    RefreshCcw,
    ListFilter,
    Plus,
    Search,
    FilterX,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight
  } from "lucide-svelte";
  import type { ReceiptItem } from "$lib/types";

  interface TransactionRecord {
    raw: string[];
    index: number;
    dateWeight: number;
    total: number;
  }

  let journal = $state<TransactionRecord[]>([]);
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

  const COL = {
    DATE: 0,
    CREATOR_EMAIL: 1,
    ACCOUNT: 2,
    WATER_FEE: 3,
    ASSOC_FEE: 4,
    MISC: 5,
    MOP: 6,
    PERIOD: 7,
    TYPE: 8,
    NOTES: 9,
    NOTES_PRIVATE: 10,
    MOP_REFNO: 11,
    PR_DATE_ISSUED: 12,
    PR_REFNO: 13,
    CREATOR_NAME: 14,
    ACCOUNT_NAME: 15,
    ST_NO: 16,
    INCOMING: 17,
    OUTGOING: 18,
    BALANCE: 19,
    WAS_AUDITED: 20,
    LEGACY_RECEIPT_URL: 21,
    ID: 22
  };

  async function loadData() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "journal_general!A:W");
      if (rows.length === 0) {
        journal = [];
        return;
      }

      const constRows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "constants!A:C");
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

      journal = rows.slice(1).map((row, idx) => {
        const water = parseCSVAmount(row[COL.WATER_FEE]);
        const assoc = parseCSVAmount(row[COL.ASSOC_FEE]);
        const misc = parseCSVAmount(row[COL.MISC]);
        return {
          raw: row,
          index: idx + 2,
          dateWeight: parseDateWeight(row[COL.DATE]),
          total: water + assoc + misc
        };
      });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  const filteredJournal = $derived.by(() => {
    return journal
      .filter((record) => {
        const row = record.raw;
        const searchStr = (
          row[COL.ACCOUNT_NAME] +
          row[COL.ACCOUNT] +
          row[COL.CREATOR_NAME] +
          row[COL.NOTES]
        ).toLowerCase();

        const matchSearch = filterSearch === "" || searchStr.includes(filterSearch.toLowerCase());
        const matchSemester =
          !uiSettings.currentSemester || row[COL.PERIOD] === uiSettings.currentSemester;
        const matchType = filterType === "ALL" || row[COL.TYPE] === filterType;
        const matchMop = filterMop === "ALL" || row[COL.MOP] === filterMop;

        return matchSearch && matchSemester && matchType && matchMop;
      })
      .sort((a, b) => {
        const order = sortOrder === "asc" ? 1 : -1;
        if (sortKey === "DATE") {
          const wA = a.dateWeight;
          const wB = b.dateWeight;
          return (wA - wB) * order || (a.index - b.index) * order;
        }
        if (sortKey === "TOTAL") return (a.total - b.total) * order;
        if (sortKey === "ACCOUNT")
          return (
            (a.raw[COL.ACCOUNT_NAME] || "").localeCompare(b.raw[COL.ACCOUNT_NAME] || "") * order
          );
        if (sortKey === "CREATOR")
          return (
            (a.raw[COL.CREATOR_NAME] || "").localeCompare(b.raw[COL.CREATOR_NAME] || "") * order
          );
        if (sortKey === "TYPE")
          return (a.raw[COL.TYPE] || "").localeCompare(b.raw[COL.TYPE] || "") * order;
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

  function getActiveItems(row: string[]) {
    return [
      { name: "Water Fee", amount: parseCSVAmount(row[COL.WATER_FEE]) },
      { name: "Association Fee", amount: parseCSVAmount(row[COL.ASSOC_FEE]) },
      { name: "Misc Fee", amount: parseCSVAmount(row[COL.MISC]) }
    ].filter((i) => i.amount !== 0);
  }
</script>

<div class="space-y-6">
  <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="space-y-1">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">Transactions</h1>
    </div>

    <div class="flex items-end gap-3">
      <TermFilter onSelect={() => loadData()} />
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={loadData} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
          <span class="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" href="/legacy/admin/transactions/add">
          <Plus class="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  </header>

  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <div class="space-y-1.5">
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

    <div class="space-y-1.5">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Transaction Type</Label>
      <Select.Root type="single" bind:value={filterType}>
        <Select.Trigger class="h-9 text-xs font-semibold">
          {filterType === "ALL" ? "All Types" : filterType}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">All Types</Select.Item>
          {#each transactionTypes as type}
            <Select.Item value={type.value}>{type.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="space-y-1.5">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Payment Processor</Label>
      <Select.Root type="single" bind:value={filterMop}>
        <Select.Trigger class="h-9 text-xs font-semibold">
          {filterMop === "ALL" ? "All Methods" : translateMop(filterMop)}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ALL">All Methods</Select.Item>
          {#each mopTypes as mop}
            <Select.Item value={mop.value}>{mop.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="flex items-end">
      <Button
        variant="ghost"
        size="sm"
        onclick={resetFilters}
        class="h-9 text-xs text-muted-foreground"
      >
        <FilterX class="mr-2 h-4 w-4" /> Clear Filters
      </Button>
    </div>
  </div>

  {#if isLoading}
    <div class="flex h-64 flex-col items-center justify-center gap-2">
      <Loader2 class="h-8 w-8 animate-spin" />
      <p>Loading transactions...</p>
    </div>
  {:else if error}
    <div
      class="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-destructive/10 bg-destructive/5"
    >
      <p class="text-sm font-bold text-destructive">{error}</p>
      <Button variant="outline" size="sm" onclick={loadData}>Try Again</Button>
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
                  onclick={() => goto(`/legacy/admin/transactions/${record.raw[COL.ID] || ""}`)}
                >
                  <Table.Cell class="px-4 py-2 align-top text-xs text-slate-500 tabular-nums"
                    >{formatDate(record.raw[COL.DATE])}</Table.Cell
                  >
                  <Table.Cell class="px-4 py-2 align-top">
                    <div class="flex flex-col">
                      <span class="text-[11px] leading-tight font-bold text-slate-900"
                        >{record.raw[COL.CREATOR_NAME]}</span
                      >
                      <span class="text-[9px] font-medium text-muted-foreground"
                        >{record.raw[COL.CREATOR_EMAIL]}</span
                      >
                    </div>
                  </Table.Cell>
                  <Table.Cell class="w-64 px-4 py-2 align-top">
                    <div class="flex flex-col">
                      <span class="text-[11px] leading-tight font-bold text-slate-900"
                        >{record.raw[COL.ACCOUNT_NAME]}</span
                      >
                      <span class="text-[9px] font-medium text-muted-foreground"
                        >{record.raw[COL.ACCOUNT]}</span
                      >
                    </div>
                  </Table.Cell>
                  <Table.Cell class="px-4 py-2 align-top">
                    <div class="flex flex-col">
                      <span class="text-[10px] font-bold tracking-tight text-slate-600 uppercase"
                        >{translateType(record.raw[COL.TYPE])}</span
                      >
                      <span class="text-[9px] text-muted-foreground"
                        >{translateMop(record.raw[COL.MOP])}</span
                      >
                    </div>
                  </Table.Cell>
                  <Table.Cell class="max-w-[200px] truncate px-4 py-2 align-top"
                    ><span class="text-[10px] text-slate-600">{record.raw[COL.NOTES] || "—"}</span
                    ></Table.Cell
                  >
                  <Table.Cell class="px-4 py-2 text-right align-top"
                    ><span class="font-mono text-xs font-bold text-slate-900"
                      >{formatAccounting(record.total)}</span
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
