<script lang="ts">
  import { onMount } from "svelte";
  import { emailDispatcher } from "$lib/dispatcher.svelte";
  import { AcknowledgmentTemplate } from "$lib/templates/acknowledgment";
  import { goto } from "$app/navigation";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, batchUpdateValues, invalidateCache } from "$lib/google-sheets";
  import {
    parseCSVAmount,
    calculateTotal,
    formatCurrency,
    translatePeriod,
    translateMop,
    formatAmount,
    formatDate
  } from "$lib/receipt-utils";
  import { auth } from "$lib/auth.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    FileCheck,
    CircleAlert,
    CircleCheckBig,
    ArrowUpDown,
    Trash2
  } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import { encryptJSON } from "$lib/crypto";
  import type { ReceiptData } from "$lib/types";

  let queue = $state<JournalRecord[]>([]);
  let selectedIndices = $state<Set<number>>(new Set()); // Stores rowIndex
  let isLoading = $state(false);
  let isDeleting = $state(false);
  let error = $state<string | null>(null);

  // Sort State
  type SortKey = "DATE" | "ACCOUNT" | "TOTAL";
  let sortKey = $state<SortKey>("DATE");
  let sortOrder = $state<"asc" | "desc">("desc");

  // Column Mapping
  import { JOURNAL_COL as JOR, type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal, parseAmount } from "$lib/resident-logic";

  function pluralize(count: number, singular: string, plural: string) {
    const pr = new Intl.PluralRules("en-US");
    const type = pr.select(count);
    return type === "one" ? `${count} ${singular}` : `${count} ${plural}`;
  }

  async function loadData(forceRefresh = false) {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();

    try {
      const rows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "journal_general!A:V",
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

  const sortedQueue = $derived.by(() => {
    return [...queue].sort((a, b) => {
      const order = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "DATE")
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * order;
      if (sortKey === "ACCOUNT") return (a.name || "").localeCompare(b.name || "") * order;
      if (sortKey === "TOTAL") return (a.amount - b.amount) * order;
      return 0;
    });
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) sortOrder = sortOrder === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortOrder = key === "DATE" ? "desc" : "asc";
    }
  }

  function toggleSelectAll() {
    if (selectedIndices.size === queue.length) selectedIndices = new Set();
    else selectedIndices = new Set(queue.map((item) => item.ledgerIndex!));
  }

  function toggleSelect(rowIndex: number) {
    if (selectedIndices.has(rowIndex)) selectedIndices.delete(rowIndex);
    else selectedIndices.add(rowIndex);
    selectedIndices = new Set(selectedIndices);
  }

  async function prepareDispatch() {
    if (selectedIndices.size === 0) return;
    const baseUrl = window.location.origin + "/legacy/receipt";
    const stagedEmails = [];

    const selectedRows = queue.filter((item) => selectedIndices.has(item.ledgerIndex!));
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
        id: record.ledgerIndex!.toString(),
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
          await batchUpdateValues(brandingState.spreadsheetId, updates);
          invalidateCache();
        }
      });
    }

    emailDispatcher.pushBatch(stagedEmails);
    goto("/legacy/admin/email-dispatcher");
  }

  async function deleteSelected() {
    if (selectedIndices.size === 0) return;
    isDeleting = false;
    isLoading = true;
    error = null;

    try {
      const updates = Array.from(selectedIndices).map((idx) => ({
        range: `journal_general!A${idx}:W${idx}`,
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
          Settle
        </Button>

        <AlertDialog.Root bind:open={isDeleting}>
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="outline"
                size="sm"
                disabled={isLoading || selectedIndices.size === 0}
              >
                <Trash2 class="mr-2 h-4 w-4" />
                Delete
              </Button>
            {/snippet}
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

  {#if error}
    <div
      class="flex items-center gap-3 rounded-lg border bg-muted/20 p-4 text-sm font-medium text-destructive"
    >
      <CircleAlert class="h-4 w-4" />
      <p>{error}</p>
    </div>
  {/if}

  <div class="mb-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
    <TermFilter onSelect={() => loadData()} />
  </div>

  {#if isLoading}
    <LoadingView text="Loading records..." />
  {:else if queue.length > 0}
    <Card.Root class="overflow-hidden p-0">
      <Card.Content class="p-0">
        <Table.Root>
          <Table.Header>
            <Table.Row class="bg-muted/5">
              <Table.Head class="w-10 px-4">
                <Checkbox
                  checked={selectedIndices.size === queue.length && queue.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </Table.Head>
              <Table.Head class="px-2 py-3"
                ><button
                  onclick={() => toggleSort("DATE")}
                  class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase transition-colors hover:text-slate-900"
                  >Date {#if sortKey === "DATE"}{sortOrder === "asc" ? "↑" : "↓"}{:else}<ArrowUpDown
                      class="h-3 w-3 opacity-30"
                    />{/if}</button
                ></Table.Head
              >
              <Table.Head class="px-2 py-3"
                ><button
                  onclick={() => toggleSort("ACCOUNT")}
                  class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase transition-colors hover:text-slate-900"
                  >Account {#if sortKey === "ACCOUNT"}{sortOrder === "asc"
                      ? "↑"
                      : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                ></Table.Head
              >
              <Table.Head class="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase"
                >Composition</Table.Head
              >
              <Table.Head
                class="px-2 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase"
                >Amount</Table.Head
              >
              <Table.Head class="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase"
                >Payment Details</Table.Head
              >
              <Table.Head class="px-4 py-3"
                ><button
                  onclick={() => toggleSort("TOTAL")}
                  class="flex w-full items-center justify-end gap-1.5 text-[10px] font-bold text-muted-foreground uppercase transition-colors hover:text-slate-900"
                  >Total {#if sortKey === "TOTAL"}{sortOrder === "asc"
                      ? "↑"
                      : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                ></Table.Head
              >
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each sortedQueue as record}
              {@const activeItems = getActiveItems(record)}
              <Table.Row
                class="group cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/5 {selectedIndices.has(
                  record.ledgerIndex!
                )
                  ? 'bg-muted/5'
                  : ''}"
                onclick={() => toggleSelect(record.ledgerIndex!)}
              >
                <Table.Cell class="w-10 px-4 py-2 align-top"
                  ><Checkbox
                    checked={selectedIndices.has(record.ledgerIndex!)}
                    onCheckedChange={() => toggleSelect(record.ledgerIndex!)}
                    onclick={(e) => e.stopPropagation()}
                    aria-label="Select row"
                  /></Table.Cell
                >
                <Table.Cell class="w-32 px-2 py-2 align-top text-nowrap"
                  ><span class="text-xs text-slate-500 tabular-nums">{formatDate(record.date)}</span
                  ></Table.Cell
                >
                <Table.Cell class="w-64 px-2 py-2 align-top"
                  ><span class="text-sm leading-tight font-bold text-slate-900">{record.name}</span
                  ></Table.Cell
                >
                <Table.Cell colspan={2} class="p-0 align-top">
                  <div class="flex flex-col">
                    {#each activeItems as fee}
                      <div
                        class="flex items-center justify-between border-b border-muted/10 px-3 py-1.5 last:border-b-0"
                      >
                        <div class="flex flex-col">
                          <span class="text-xs font-semibold text-slate-700">{fee.name}</span><span
                            class="text-[9px] font-bold tracking-tighter text-muted-foreground uppercase"
                            >{record.type}</span
                          >
                        </div>
                        <span class="font-mono text-xs font-bold text-slate-600 tabular-nums"
                          >{formatAmount(fee.amount)}</span
                        >
                      </div>
                    {/each}
                  </div>
                </Table.Cell>
                <Table.Cell class="px-2 py-2 align-top"
                  ><div class="flex flex-col">
                    <span
                      class="text-[10px] leading-none font-bold tracking-tight text-slate-600 uppercase"
                      >{translateMop(record.mop)}</span
                    ><span class="mt-0.5 text-[9px] text-muted-foreground tabular-nums"
                      >{record.mopRefNo === "N/A" || !record.mopRefNo
                        ? "No Reference Code"
                        : record.mopRefNo}</span
                    >
                  </div></Table.Cell
                >
                <Table.Cell class="px-4 py-2 text-right align-top"
                  ><span
                    class="font-mono text-sm font-bold whitespace-nowrap text-slate-900 tabular-nums"
                    >{formatCurrency(record.amount)}</span
                  ></Table.Cell
                >
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  {:else if !isLoading && !error}
    <div
      class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
    >
      <CircleCheckBig class="h-8 w-8" />
      <div class="text-center">
        <p class="font-semibold text-slate-900">No pending entries.</p>
      </div>
    </div>
  {/if}
</div>
