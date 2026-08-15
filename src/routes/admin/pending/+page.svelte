<script lang="ts">
  import { onMount } from "svelte";
  import { emailDispatcher } from "$state/dispatcher.svelte";
  import { AcknowledgmentTemplate } from "$templates/acknowledgment";
  import { goto } from "$app/navigation";
  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import {
    fetchJournalEntries,
    updateJournalReceiptInfo,
    mapRowToJournal
  } from "$api/controllers/journal-controller";
  import { fetchTransactionTypes } from "$api/controllers/constants-controller";
  import { parseDateWeight } from "$utils/parsers";
  import { Input } from "$ui/input/index.js";
  import { Label } from "$ui/label/index.js";
  import { Button } from "$ui/button/index.js";
  import TermFilter from "$components/TermFilter.svelte";
  import { Search, RefreshCcw, FileCheck, CircleCheckBig } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import type { ReceiptData } from "$lib/types";

  import { type JournalRecord } from "$lib/types";

  let queue = $state<JournalRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let selectedIndices = $state<Set<string>>(new Set());
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const tableSync = new TableSync({
    initialFilters: { search: "" },
    paramMap: { search: "q" },
    searchKey: "search"
  });

  const filteredQueue = $derived.by(() => {
    return queue.filter((r) => {
      const search = tableSync.filters!.search.toLowerCase();
      return (
        r.name?.toLowerCase().includes(search) ||
        r.account?.toLowerCase().includes(search) ||
        r.notes?.toLowerCase().includes(search) ||
        r.mopRefNo?.toLowerCase().includes(search)
      );
    });
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    selectedIndices = new Set();

    try {
      const [entries, types, currentTerm] = await Promise.all([
        fetchJournalEntries(undefined, undefined, bypassCache),
        fetchTransactionTypes(bypassCache),
        uiSettings.ensureCurrentTerm()
      ]);

      transactionTypes = types;

      const journals = Array.isArray(entries) ? entries : entries.items;

      queue = journals
        .map((journal) => ({
          ...journal,
          dateWeight: parseDateWeight(journal.date)
        }))
        .filter((r) => {
          return (
            r.period === currentTerm.trim() &&
            (!r.prDateIssued || r.prDateIssued === "#N/A") &&
            r.prRefNo !== "N/A" &&
            r.prRefNo !== "#N/A"
          );
        })
        .sort((a, b) => b.dateWeight - a.dateWeight || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0));
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  async function prepareDispatch() {
    if (selectedIndices.size === 0) {
      return;
    }
    const stagedEmails = [];

    const selectedRows = queue.filter((item) => selectedIndices.has(item.id!.toString()));
    const branding = brandingState.profile;

    for (const record of selectedRows) {
      const recipient = (record.account || "").trim();
      if (!recipient || !recipient.includes("@")) continue;

      const prRefNo = record.prRefNo || crypto.randomUUID();
      const dateIssued = record.prDateIssued || new Date().toISOString().split("T")[0];

      const receipt: ReceiptData = {
        dateIssued,
        paymentDate: record.date,
        processor: record.mop,
        referenceNumber: record.mopRefNo || "N/A",
        period: record.period,
        seriesNumber: prRefNo,
        receivedFrom: record.name || "N/A",
        receivedBy: record.creatorName || "N/A",
        notes: record.notes,
        transactionType: record.type,
        branding: brandingState.selectedKey,
        stno: record.stno.toString(),
        items: getActiveItems(record)
      };

      const url = `${window.location.origin}/receipt/${record.id}`;

      stagedEmails.push({
        id: record.id.toString(),
        to: recipient,
        recipientName: receipt.receivedFrom,
        template: AcknowledgmentTemplate as any,
        data: {
          accountFullName: receipt.receivedFrom,
          date: receipt.paymentDate,
          type: receipt.transactionType,
          receiptUrl: url,
          seriesNumber: receipt.seriesNumber,
          items: receipt.items
        },
        branding: branding,
        onSuccess: async () => {
          await updateJournalReceiptInfo(record.id, dateIssued, prRefNo, url);
        }
      });
    }

    emailDispatcher.batchType = "ACKNOWLEDGMENT";
    emailDispatcher.pushBatch(stagedEmails);
    goto("/admin/email-dispatcher");
  }

  function getActiveItems(r: JournalRecord) {
    return [
      { name: "Water Fee", amount: r.water },
      { name: "Association Fee", amount: r.assoc },
      { name: "Miscellaneous", amount: r.misc }
    ].filter((i) => i.amount !== 0);
  }
</script>

<div class="space-y-3">
  <SubpageHeader title="Pending Receipts" isTopLevel={true}>
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => loadData(true)}
        {isLoading}
        icon={RefreshCcw}
      />
    {/snippet}
  </SubpageHeader>

  {#if isLoading && queue.length === 0}
    <LoadingView />
  {:else if error}
    <ErrorView {error} class="mb-3">
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
    <FilterDrawer activeCount={Number(tableSync.filters!.search !== "")}>
      <div class="mb-4 grid gap-2 lg:grid-cols-12">
        <div class="lg:col-span-3">
          <TermFilter onSelect={() => loadData()} />
        </div>
        <div class="space-y-1 lg:col-span-9">
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
      </div>
    </FilterDrawer>

    {#if filteredQueue.length > 0}
      <DataTable
        data={filteredQueue}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
        onSelectionChange={(ids) => (selectedIndices = ids)}
        meta={{ transactionTypes }}
        rowId="id"
        enableSelection
      >
        {#snippet actions()}
          <Button size="sm" onclick={prepareDispatch} {isLoading} icon={FileCheck}>Settle</Button>
        {/snippet}
      </DataTable>
    {:else}
      <EmptyView title="No pending entries.">
        {#snippet icon()}
          <CircleCheckBig class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
