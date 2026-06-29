<script lang="ts">
  import { onMount } from "svelte";
  import { emailDispatcher } from "$lib/dispatcher.svelte";
  import { AcknowledgmentTemplate } from "$lib/templates/acknowledgment";
  import { goto } from "$app/navigation";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, batchUpdateValues, invalidateCache } from "$lib/google-sheets";
  import { parseDateWeight } from "$lib/receipt-utils";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { Search, RefreshCcw, FileCheck, CircleCheckBig } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import type { ReceiptData } from "$lib/types";

  import { type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal } from "$lib/resident-logic";

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

  async function loadData(forceRefresh = false) {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();

    try {
      const [rows, constRows] = await Promise.all([
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "journal_general!A:T", forceRefresh),
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C", forceRefresh)
      ]);

      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));

      queue = rows
        .slice(1)
        .map((row, idx) => {
          const journal = mapRowToJournal(row, idx + 2);
          return {
            ...journal,
            dateWeight: parseDateWeight(journal.date)
          };
        })
        .filter((r) => {
          return (
            r.period === uiSettings.currentTerm.trim() &&
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
          const updates = [
            {
              range: `journal_general!M${record.ledgerIndex}:N${record.ledgerIndex}`,
              values: [[dateIssued, prRefNo]]
            },
            { range: `journal_general!S${record.ledgerIndex}`, values: [[url]] }
          ];
          await batchUpdateValues(uiSettings.accountingWorkbookId!, updates);
          invalidateCache();
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
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData(true)}
          {isLoading}
          icon={RefreshCcw}
        />

        <Button
          size="sm"
          onclick={prepareDispatch}
          {isLoading}
          disabled={selectedIndices.size === 0}
          icon={FileCheck}
        >
          Settle
        </Button>
      </div>
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
    <div class="mb-4 grid gap-2 lg:grid-cols-12">
      <div class="lg:col-span-3">
        <TermFilter onSelect={() => loadData()} />
      </div>
      <div class="space-y-1 lg:col-span-9">
        <Label class="text-xs font-bold text-muted-foreground uppercase">Search</Label>
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
      />
    {:else}
      <EmptyView title="No pending entries.">
        {#snippet icon()}
          <CircleCheckBig class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
