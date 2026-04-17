<script lang="ts">
  import { onMount } from "svelte";
  import { emailDispatcher } from "$lib/dispatcher.svelte";
  import { AcknowledgmentTemplate } from "$lib/templates/acknowledgment";
  import { goto } from "$app/navigation";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, batchUpdateValues, invalidateCache } from "$lib/google-sheets";
  import { pluralize } from "$lib/receipt-utils";
  import { encryptJSON } from "$lib/crypto";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { Search, RefreshCcw, FileCheck, Trash2, CircleCheckBig } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import type { ReceiptData } from "$lib/types";

  import { type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal } from "$lib/resident-logic";

  let queue = $state<JournalRecord[]>([]);
  let selectedIndices = $state<Set<string>>(new Set()); // Synced with DataTable (stno or ledgerIndex)
  let isLoading = $state(false);
  let isDeleting = $state(false);
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
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();

    try {
      const rows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "journal_general!A:W",
        forceRefresh
      );
      queue = rows
        .slice(1)
        .map((row, idx) => mapRowToJournal(row, idx + 2))
        .filter((r) => {
          return (
            r.period === uiSettings.currentSemester.trim() &&
            (!r.prDateIssued || r.prDateIssued === "#N/A") &&
            r.prRefNo !== "N/A" &&
            r.prRefNo !== "#N/A"
          );
        });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  async function prepareDispatch() {
    if (selectedIndices.size === 0) return;
    const baseUrl = window.location.origin + "/legacy/receipt";
    const stagedEmails = [];

    const selectedRows = queue.filter((item) => selectedIndices.has(item.ledgerIndex!.toString()));
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
        items: getActiveItems(record)
      };

      const encrypted = await encryptJSON(receipt, record.stno.toString().trim());
      const url = `${baseUrl}?data=${encrypted}`;

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
            { range: `journal_general!V${record.ledgerIndex}`, values: [[url]] }
          ];
          await batchUpdateValues(brandingState.spreadsheetId!, updates);
          invalidateCache();
        }
      });
    }

    emailDispatcher.pushBatch(stagedEmails);
    goto("/admin/email-dispatcher");
  }

  async function deleteSelected() {
    if (selectedIndices.size === 0) return;
    isDeleting = false;
    isLoading = true;
    error = null;

    try {
      const selectedRecords = queue.filter((r) => selectedIndices.has(r.ledgerIndex!.toString()));
      const updates = selectedRecords.map((r) => ({
        range: `journal_general!A${r.ledgerIndex}:W${r.ledgerIndex}`,
        values: [new Array(23).fill("")]
      }));

      await batchUpdateValues(brandingState.spreadsheetId, updates);
      invalidateCache();
      await loadData(true);
    } catch (e: any) {
      error = `Deletion failed: ${e.message}`;
    } finally {
      isDeleting = false;
      isLoading = false;
    }
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
  <SubpageHeader title="Pending Receipts">
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
          <RefreshCcw class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          onclick={prepareDispatch}
          disabled={isLoading || selectedIndices.size === 0}
        >
          <FileCheck class="mr-2 h-4 w-4" />
          Settle ({selectedIndices.size})
        </Button>

        <AlertDialog.Root>
          <AlertDialog.Trigger>
            <Button variant="outline" size="sm" disabled={isLoading || selectedIndices.size === 0}>
              <Trash2 class="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Confirm Deletion</AlertDialog.Title>
              <AlertDialog.Description>
                You are about to delete {pluralize(selectedIndices.size, "entry", "entries")}. This
                will permanently clear the record from the journal. This action cannot be undone.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action onclick={deleteSelected}>Proceed</AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading && queue.length === 0}
    <LoadingView text="Loading records..." />
  {:else if error}
    <ErrorView {error} class="mb-3">
      <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}>Try Again</Button>
    </ErrorView>
  {:else}
    <div class="mb-4 grid gap-2 lg:grid-cols-12">
      <div class="lg:col-span-2">
        <TermFilter onSelect={() => loadData()} />
      </div>
      <div class="space-y-1 lg:col-span-10">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
        <div class="relative">
          <Search
            class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={tableSync.filters!.search}
            placeholder="Search by name, account, or notes..."
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
      />
    {:else}
      <div
        class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
      >
        <CircleCheckBig class="h-8 w-8 text-muted-foreground" />
        <div class="text-center">
          <p class="font-semibold text-foreground">No pending entries.</p>
        </div>
      </div>
    {/if}
  {/if}
</div>
