<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, batchUpdateValues } from "$lib/google-sheets";
  import {
    parseCSVAmount,
    calculateTotal,
    formatCurrency,
    translatePeriod,
    translateMop,
    formatAmount,
    formatDate
  } from "$lib/receipt-utils";
  import { mailMerge } from "$lib/mail-merge";
  import { createEmail, sendEmail } from "$lib/gmail";
  import { auth } from "$lib/auth.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import * as Select from "$lib/components/ui/select";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    Loader2,
    RefreshCcw,
    FileCheck,
    AlertCircle,
    CheckCircle2,
    ListFilter,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Eye,
    Mail,
    Play,
    ChevronLeft,
    ChevronRight,
    BarChart3,
    Plus
  } from "lucide-svelte";
  import { encryptJSON } from "$lib/crypto";
  import type { ReceiptData, ReceiptItem } from "$lib/types";

  interface PendingRow {
    rowIndex: number; // 1-indexed for Sheets
    data: any;
    raw: string[];
  }

  interface SemesterOption {
    value: string;
    label: string;
    description: string;
  }

  interface StagedDispatch {
    row: PendingRow;
    receipt: ReceiptData;
    url: string;
    updatePayload: { range: string; values: any[][] }[];
    recipient: string;
  }

  let queue = $state<PendingRow[]>([]);
  let selectedIndices = $state<Set<number>>(new Set()); // Stores rowIndex
  let isLoading = $state(false);
  let isConfirming = $state(false);
  let error = $state<string | null>(null);

  // Email/Dispatch Mode State
  let isDispatchMode = $state(false);
  let stagedDispatch = $state<StagedDispatch[]>([]);
  let isSending = $state(false);
  let isSuccess = $state(false);
  let dispatchProgress = $state({ current: 0, total: 0 });
  let previewIndex = $state(0);

  const batchTotal = $derived(
    stagedDispatch.reduce((acc, item) => acc + calculateTotal(item.receipt.items), 0)
  );

  const feeBreakdown = $derived(
    stagedDispatch.reduce(
      (acc, item) => {
        item.receipt.items.forEach((fee) => {
          acc[fee.name] = (acc[fee.name] || 0) + fee.amount;
        });
        return acc;
      },
      {} as Record<string, number>
    )
  );

  // Sort State
  type SortKey = "DATE" | "ACCOUNT" | "TOTAL";
  let sortKey = $state<SortKey>("DATE");
  let sortOrder = $state<"asc" | "desc">("desc");

  // Column Mapping
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
    LEGACY_RECEIPT_URL: 21
  };

  const emailTemplate = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #000; line-height: 1.5;">
  <div style="margin-bottom: 25px;">
    <img src="{{HEADER_IMAGE_URL}}" width="100%" alt="Header" style="display: block; border: none;">
  </div>

  <h2 style="font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 25px;">ACKNOWLEDGMENT RECEIPT</h2>

  <p style="margin-bottom: 20px;">Hi, {{ACCOUNT_FULL_NAME}}</p>

  <p style="margin-bottom: 25px;">
    {{TYPE|COLLECTION_OTHERS|Thank you for your payment last {{DATE}}. }}{{TYPE|COLLECTION|Thank you for your payment last {{DATE}}. }}{{TYPE|REFUND|Your payment was refunded. }}{{TYPE|WAIVED|A portion of your semestral fees to the Association has been waived. }}{{TYPE|RECLASSIFY|This is a correction to a previously-issued receipt. }}Please find the acknowledgment receipt linked below for your records.
  </p>

  <div style="text-align: center; margin: 35px 0;">
    <a href="{{RECEIPT_URL}}" style="color: #0047AB; font-size: 24px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">VIEW RECEIPT HERE</a>
  </div>

  <p style="margin-bottom: 20px;">
    We recommend retaining this email for future reference. <strong>Please verify that the amounts listed on the receipt are correct.</strong> The records will be deemed final one week after you receive this email.
  </p>

  <p style="margin-bottom: 25px;">
    For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:{{REPLY_TO}}" style="color: #0047AB;">{{REPLY_TO}}</a>.
  </p>

  <div style="font-size: 12px; color: #777; margin-top: 40px;">
    <p style="margin-bottom: 15px;">This is a system-generated message. When responding to this email, please use the reply address provided (this will be done automatically by Gmail or your email client when you select "Reply").</p>
    
    <p style="font-weight: bold; margin-bottom: 5px;">COMMUNICATION CONFIDENTIALITY NOTICE</p>
    <p style="font-style: italic; line-height: 1.3;">
      This message, its thread, and any attachments are privileged, confidential and intended for the specified recipient only. No part of this message may be shared in any form or manner without the consent of the sender. If you are not the intended recipient of this message, please inform the sender immediately and delete the message from your inbox.
    </p>
  </div>
</div>`;

  function pluralize(count: number, singular: string, plural: string) {
    const pr = new Intl.PluralRules("en-US");
    const type = pr.select(count);
    return type === "one" ? `${count} ${singular}` : `${count} ${plural}`;
  }

  async function loadData() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    isDispatchMode = false;
    isSuccess = false;

    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "journal_general!A:V");
      queue = rows
        .slice(1)
        .map((row, idx) => ({
          rowIndex: idx + 2,
          raw: row,
          data: row
        }))
        .filter((item) => {
          const row = item.raw;
          const h = (row[COL.PERIOD] || "").trim();
          const m = (row[COL.PR_DATE_ISSUED] || "").trim();
          const n = (row[COL.PR_REFNO] || "").trim();
          return (
            h === uiSettings.currentSemester.trim() &&
            (!m || m === "#N/A") &&
            n !== "N/A" &&
            n !== "#N/A"
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
        return (new Date(a.raw[COL.DATE]).getTime() - new Date(b.raw[COL.DATE]).getTime()) * order;
      if (sortKey === "ACCOUNT")
        return (a.raw[COL.ACCOUNT_NAME] || "").localeCompare(b.raw[COL.ACCOUNT_NAME] || "") * order;
      if (sortKey === "TOTAL")
        return (
          (calculateTotal(getActiveItems(a.raw)) - calculateTotal(getActiveItems(b.raw))) * order
        );
      return 0;
    });
  });

  const emailPreview = $derived.by(() => {
    if (stagedDispatch.length === 0 || !stagedDispatch[previewIndex])
      return { subject: "", body: "" };
    const item = stagedDispatch[previewIndex];
    const branding = brandingState.profile;

    const body = mailMerge(emailTemplate, {
      ACCOUNT_FULL_NAME: item.receipt.receivedFrom,
      DATE: formatDate(item.receipt.paymentDate),
      TYPE: item.receipt.transactionType,
      RECEIPT_URL: item.url,
      ISSUER: branding.issuerName.toUpperCase(),
      REPLY_TO: branding.replyTo,
      HEADER_IMAGE_URL: branding.emailHeaderUrl
    });

    const subject = `Your ${branding.shortName} Receipt PMT-${item.receipt.seriesNumber}`;
    return { subject, body };
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
    else selectedIndices = new Set(queue.map((item) => item.rowIndex));
  }

  function toggleSelect(rowIndex: number) {
    if (selectedIndices.has(rowIndex)) selectedIndices.delete(rowIndex);
    else selectedIndices.add(rowIndex);
    selectedIndices = new Set(selectedIndices);
  }

  async function prepareDispatch() {
    if (selectedIndices.size === 0) return;
    isConfirming = false;
    const baseUrl = window.location.origin + "/legacy/receipt";
    const tempStaged: StagedDispatch[] = [];

    const selectedRows = queue.filter((item) => selectedIndices.has(item.rowIndex));

    for (const item of selectedRows) {
      const row = item.raw;
      const prRefNo = row[COL.PR_REFNO] || crypto.randomUUID();
      const dateIssued = row[COL.PR_DATE_ISSUED] || new Date().toISOString().split("T")[0];

      const receipt: ReceiptData = {
        dateIssued,
        paymentDate: row[COL.DATE],
        processor: row[COL.MOP],
        referenceNumber: row[COL.MOP_REFNO] || "N/A",
        period: row[COL.PERIOD],
        seriesNumber: prRefNo,
        receivedFrom: row[COL.ACCOUNT_NAME] || "N/A",
        receivedBy: row[COL.CREATOR_NAME] || "N/A",
        notes: row[COL.NOTES],
        transactionType: row[COL.TYPE],
        branding: brandingState.selectedKey,
        items: getActiveItems(row)
      };

      const encrypted = await encryptJSON(receipt, (row[COL.ST_NO] || "N/A").toString().trim());
      const url = `${baseUrl}?data=${encrypted}`;

      tempStaged.push({
        row: item,
        receipt,
        url,
        recipient: row[COL.ACCOUNT] || "",
        updatePayload: [
          {
            range: `journal_general!M${item.rowIndex}:N${item.rowIndex}`,
            values: [[dateIssued, prRefNo]]
          },
          { range: `journal_general!V${item.rowIndex}`, values: [[url]] }
        ]
      });
    }

    stagedDispatch = tempStaged;
    isDispatchMode = true;
    previewIndex = 0;
  }

  async function runBatchDispatch() {
    if (!auth.accessToken) {
      alert("Please re-authenticate.");
      return;
    }

    isSending = true;
    isSuccess = false;
    error = null;
    dispatchProgress = { current: 0, total: stagedDispatch.length };
    const branding = brandingState.profile;

    const allUpdates: { range: string; values: any[][] }[] = [];

    for (const item of stagedDispatch) {
      try {
        const recipient = item.recipient.trim();
        if (!recipient || !recipient.includes("@")) {
          dispatchProgress.current++;
          continue;
        }

        const mergedBody = mailMerge(emailTemplate, {
          ACCOUNT_FULL_NAME: item.receipt.receivedFrom,
          DATE: formatDate(item.receipt.paymentDate),
          TYPE: item.receipt.transactionType,
          RECEIPT_URL: item.url,
          ISSUER: branding.issuerName.toUpperCase(),
          REPLY_TO: branding.replyTo,
          HEADER_IMAGE_URL: branding.emailHeaderUrl
        });

        const subject = `Your ${branding.shortName} Receipt PMT-${item.receipt.seriesNumber}`;
        const raw = createEmail(recipient, subject, mergedBody, branding.replyTo);
        await sendEmail(auth.accessToken, raw);

        allUpdates.push(...item.updatePayload);
        dispatchProgress.current++;
        await new Promise((r) => setTimeout(r, 150));
      } catch (e: any) {
        error = `Dispatch failed at ${item.receipt.receivedFrom}: ${e.message}`;
        isSending = false;
        return;
      }
    }

    try {
      if (allUpdates.length > 0) {
        await batchUpdateValues(brandingState.spreadsheetId, allUpdates);
      }
      isSuccess = true;
      setTimeout(() => loadData(), 2000);
    } catch (e: any) {
      error = `Ledger sync failed: ${e.message}. Emails were sent, but the sheet was not updated`;
      isSending = false;
    }
  }

  function getActiveItems(row: string[]) {
    return [
      { name: "Water Fee", amount: parseCSVAmount(row[COL.WATER_FEE]) },
      { name: "Association Fee", amount: parseCSVAmount(row[COL.ASSOC_FEE]) },
      { name: "Miscellaneous", amount: parseCSVAmount(row[COL.MISC]) }
    ].filter((i) => i.amount !== 0);
  }
</script>

<div class="space-y-6">
  {#if !isDispatchMode}
    <!-- LEDGER VIEW -->
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-1">
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">Pending Receipts</h1>
      </div>

      <div class="flex items-end gap-3">
        <TermFilter onSelect={() => loadData()} />
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onclick={loadData} disabled={isLoading}>
            <RefreshCcw class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
            Refresh
          </Button>

          <AlertDialog.Root bind:open={isConfirming}>
            <AlertDialog.Trigger>
              {#snippet child({ props })}
                <Button {...props} size="sm" disabled={isLoading || selectedIndices.size === 0}>
                  <FileCheck class="mr-2 h-4 w-4" />
                  Settle
                </Button>
              {/snippet}
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Confirm Settlement</AlertDialog.Title>
                <AlertDialog.Description>
                  You are about to generate {pluralize(
                    selectedIndices.size,
                    "receipt",
                    "receipts"
                  )}. Data will be written to the ledger after successful email dispatch.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action onclick={prepareDispatch}>Proceed</AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </div>
      </div>
    </header>

    {#if error}
      <div
        class="flex items-center gap-3 rounded-lg border bg-muted/20 p-4 text-sm font-medium text-destructive"
      >
        <AlertCircle class="h-4 w-4" />
        <p>{error}</p>
      </div>
    {/if}

    {#if isLoading}
      <div class="flex h-64 flex-col items-center justify-center gap-2">
        <Loader2 class="h-8 w-8 animate-spin" />
        <p>Loading records...</p>
      </div>
    {:else if queue.length > 0}
      <Card.Root class="overflow-hidden">
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
                    >Date {#if sortKey === "DATE"}{sortOrder === "asc"
                        ? "↑"
                        : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
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
              {#each sortedQueue as item}
                {@const activeItems = getActiveItems(item.raw)}
                {@const mopRef = item.raw[COL.MOP_REFNO]}
                <Table.Row
                  class="group cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/5 {selectedIndices.has(
                    item.rowIndex
                  )
                    ? 'bg-muted/5'
                    : ''}"
                  onclick={() => toggleSelect(item.rowIndex)}
                >
                  <Table.Cell class="w-10 px-4 py-2 align-top"
                    ><Checkbox
                      checked={selectedIndices.has(item.rowIndex)}
                      onCheckedChange={() => toggleSelect(item.rowIndex)}
                      aria-label="Select row"
                    /></Table.Cell
                  >
                  <Table.Cell class="w-32 px-2 py-2 align-top text-nowrap"
                    ><span class="text-xs text-slate-500 tabular-nums"
                      >{formatDate(item.raw[COL.DATE])}</span
                    ></Table.Cell
                  >
                  <Table.Cell class="w-64 px-2 py-2 align-top"
                    ><span class="text-sm leading-tight font-bold text-slate-900"
                      >{item.raw[COL.ACCOUNT_NAME]}</span
                    ></Table.Cell
                  >
                  <Table.Cell colspan={2} class="p-0 align-top">
                    <div class="flex flex-col">
                      {#each activeItems as fee}
                        <div
                          class="flex items-center justify-between border-b border-muted/10 px-3 py-1.5 last:border-b-0"
                        >
                          <div class="flex flex-col">
                            <span class="text-xs font-semibold text-slate-700">{fee.name}</span
                            ><span
                              class="text-[9px] font-bold tracking-tighter text-muted-foreground uppercase"
                              >{item.raw[COL.TYPE]}</span
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
                        >{translateMop(item.raw[COL.MOP])}</span
                      ><span class="mt-0.5 text-[9px] text-muted-foreground tabular-nums"
                        >{mopRef === "N/A" || !mopRef ? "No Reference Code" : mopRef}</span
                      >
                    </div></Table.Cell
                  >
                  <Table.Cell class="px-4 py-2 text-right align-top"
                    ><span
                      class="font-mono text-sm font-bold whitespace-nowrap text-slate-900 tabular-nums"
                      >{formatCurrency(calculateTotal(activeItems))}</span
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
        <CheckCircle2 class="h-8 w-8" />
        <div class="text-center">
          <p>No pending entries</p>
        </div>
      </div>
    {/if}
  {:else}
    <!-- DISPATCH VIEW -->
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-1">
        <button
          onclick={() => (isDispatchMode = false)}
          disabled={isSending || isSuccess}
          class="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft class="h-3 w-3" /> Back to Queue
        </button>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">Email Dispatcher</h1>
      </div>

      <div class="flex gap-2">
        <Button
          onclick={runBatchDispatch}
          disabled={isSending || isSuccess || !auth.accessToken}
          size="sm"
          class="min-w-[80px] bg-primary text-primary-foreground"
        >
          {#if isSending}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" /> Sending...
          {:else if isSuccess}
            <CheckCircle2 class="mr-2 h-4 w-4" /> Sent
          {:else}
            <Play class="mr-2 h-4 w-4" /> Run
          {/if}
        </Button>
      </div>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Status & Stats -->
      <div class="space-y-6 lg:col-span-1">
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <BarChart3 class="h-5 w-5" /> Statistics
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-6">
            <div class="space-y-1.5 rounded-lg border bg-muted/10 p-4">
              <p class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Batch Overview
              </p>
              <p class="text-2xl leading-tight font-bold text-slate-900">
                {pluralize(stagedDispatch.length, "Receipt", "Receipts")}
              </p>
            </div>

            <div class="space-y-3">
              <p class="px-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Fee Breakdown
              </p>
              <div class="divide-y overflow-hidden rounded-lg border bg-white">
                {#each Object.entries(feeBreakdown) as [name, amount]}
                  <div class="flex items-center justify-between p-3 text-xs">
                    <span class="font-medium text-slate-600">{name}</span>
                    <span class="font-mono font-bold text-slate-800 tabular-nums"
                      >{formatCurrency(amount)}</span
                    >
                  </div>
                {/each}
              </div>
            </div>

            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-[10px] font-bold tracking-widest text-muted-foreground/80 uppercase">
                Total Confirmation
              </p>
              <p class="text-2xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(batchTotal)}
              </p>
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Preview -->
      <div class="space-y-6 lg:col-span-2">
        <Card.Root>
          <Card.Header class="flex flex-row items-center justify-between">
            <Card.Title class="flex items-center gap-2 text-lg">
              <Eye class="h-5 w-5" /> Email Preview
            </Card.Title>
            {#if stagedDispatch.length > 1}
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  disabled={isSending || isSuccess || previewIndex === 0}
                  onclick={() => previewIndex--}><ChevronLeft class="h-4 w-4" /></Button
                >
                <span class="text-[10px] font-bold tabular-nums"
                  >{previewIndex + 1} / {stagedDispatch.length}</span
                >
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  disabled={isSending || isSuccess || previewIndex === stagedDispatch.length - 1}
                  onclick={() => previewIndex++}><ChevronRight class="h-4 w-4" /></Button
                >
              </div>
            {/if}
          </Card.Header>
          <Card.Content>
            {#if isSending || isSuccess}
              <div class="mb-4 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span>Sending Progress</span><span
                    >{dispatchProgress.current} / {dispatchProgress.total}</span
                  >
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full bg-primary transition-all duration-300"
                    style="width: {(dispatchProgress.current / dispatchProgress.total) * 100}%"
                  ></div>
                </div>
              </div>
            {/if}
            <div class="space-y-4">
              <div class="flex items-center justify-between rounded-md border bg-muted/20 p-3">
                <div>
                  <p class="text-[10px] tracking-widest text-muted-foreground uppercase">
                    Recipient
                  </p>
                  <p class="text-xs font-bold">{stagedDispatch[previewIndex]?.recipient}</p>
                </div>
                <div class="text-right">
                  <p class="text-[10px] tracking-widest text-muted-foreground uppercase">Subject</p>
                  <p class="text-xs font-semibold">{emailPreview.subject}</p>
                </div>
              </div>
              <div
                class="max-h-[500px] overflow-auto rounded-lg border bg-white p-6 whitespace-normal"
              >
                {@html emailPreview.body}
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        {#if error}
          <div
            class="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive"
          >
            <AlertCircle class="h-5 w-5" />
            <span>{error}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
