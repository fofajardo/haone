<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as Table from "$lib/components/ui/table";
  import {
    Image as ImageIcon,
    Download,
    QrCode,
    ReceiptText,
    Share2,
    StickyNote
  } from "lucide-svelte";
  import { Spinner } from "$lib/components/ui/spinner";
  import branding from "$lib/branding.json";
  import type { ReceiptData } from "$lib/types";
  import {
    calculateTotal,
    formatAmount,
    formatCurrency,
    formatDate,
    parseRef,
    translateMop,
    translatePeriod
  } from "$lib/receipt-utils";

  interface Props {
    receiptData: ReceiptData;
    qrDataUrl: string;
    isExporting: boolean;
    onDownloadPDF: () => void;
    onDownloadImage: () => void;
    onShareLink: () => void;
    onShareQR: () => void;
  }

  let {
    receiptData,
    qrDataUrl,
    isExporting,
    onDownloadPDF,
    onDownloadImage,
    onShareLink,
    onShareQR
  }: Props = $props();

  const refInfo = $derived(parseRef(receiptData.referenceNumber));
  const activeBranding = $derived(
    branding[receiptData.branding as keyof typeof branding] || branding.default
  );

  let clickedAction = $state<string | null>(null);

  $effect(() => {
    if (!isExporting) {
      clickedAction = null;
    }
  });

  function handleAction(type: string, callback: () => void) {
    clickedAction = type;
    callback();
  }
</script>

<div class="w-full max-w-2xl space-y-6 print:hidden">
  <!-- WEB VIEW -->
  <Card.Root class="overflow-hidden shadow-none ring-0 sm:shadow-lg sm:ring-1">
    <Card.Header>
      <div class="flex items-center justify-center">
        <img
          src={activeBranding.logoUrl}
          alt={activeBranding.logoAlt}
          class="h-14 w-auto object-contain transition-all"
        />
      </div>
    </Card.Header>

    <Card.Content class="space-y-6">
      <!-- Basic & Period Info -->
      <section class="space-y-4">
        <div class="mb-2 flex items-center gap-2 border-b pb-2 text-primary">
          <ReceiptText class="h-4 w-4" />
          <h3 class="text-xs font-semibold tracking-widest uppercase">Acknowledgment Receipt</h3>
        </div>
        <div class="space-y-3 px-1">
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Issuer</span>
            <span class="text-sm font-medium">{activeBranding.issuerName}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Date Issued</span>
            <span class="text-sm font-medium">{formatDate(receiptData.dateIssued)}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Payment Date</span>
            <span class="text-sm font-medium">{formatDate(receiptData.paymentDate)}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Period</span>
            <span class="text-sm font-medium">{translatePeriod(receiptData.period)}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Series Number</span>
            <span class="font-mono text-sm">{receiptData.seriesNumber}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Received From</span>
            <span class="text-sm font-medium">{receiptData.receivedFrom}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Received By</span>
            <span class="text-sm font-medium">{receiptData.receivedBy}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Payment Processor</span>
            <span class="text-sm font-medium">{translateMop(receiptData.processor)}</span>
          </div>
          <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span class="text-xs text-muted-foreground uppercase">Reference Number</span>
            <span class="font-mono text-sm">{refInfo.reference}</span>
          </div>
          {#if refInfo.invoice}
            <div class="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <span class="text-xs text-muted-foreground uppercase">InstaPay Invoice No.</span>
              <span class="font-mono text-sm">{refInfo.invoice}</span>
            </div>
          {/if}
        </div>
      </section>

      <!-- Line Items Table -->
      <div class="rounded-md border">
        <Table.Root>
          <Table.Header class="hidden bg-muted/50 sm:table-header-group">
            <Table.Row>
              <Table.Head class="h-9">Description</Table.Head>
              <Table.Head class="h-9 text-right">Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each receiptData.items as item}
              <Table.Row class="grid grid-cols-1 border-b last:border-0 sm:table-row">
                <Table.Cell class="block py-2 sm:table-cell sm:py-2.5">
                  {item.name}
                  {#if item.amount < 0}
                    <span
                      class="ml-2 rounded border px-1.5 py-0.5 text-[8px] font-medium tracking-tighter text-destructive uppercase"
                      >Refund</span
                    >
                  {/if}
                </Table.Cell>
                <Table.Cell class="block pt-0 pb-3 text-right font-medium sm:table-cell sm:py-2.5"
                  >{formatAmount(item.amount)}</Table.Cell
                >
              </Table.Row>
            {/each}
            <Table.Row class="grid grid-cols-1 border-t bg-muted/20 font-semibold sm:table-row">
              <Table.Cell class="block py-3 text-xs tracking-widest uppercase sm:table-cell"
                >Total Amount</Table.Cell
              >
              <Table.Cell class="block pt-0 pb-3 text-right text-lg sm:table-cell sm:py-3"
                >{formatCurrency(calculateTotal(receiptData.items))}</Table.Cell
              >
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </div>
      <div>
        {#if receiptData.transactionType === "WAIVED"}
          <p class="text-[11px] leading-relaxed font-medium text-primary">
            Acknowledgment of Waiver of Amount
          </p>
          <p class="text-[11px] leading-relaxed text-primary">
            The above-mentioned amount has been waived for all intents and purposes, and no further
            claims shall be made in this regard.
          </p>
        {/if}
      </div>
      <!-- Remarks -->
      <div class="space-y-6">
        {#if receiptData.notes || receiptData.transactionType === "WAIVED"}
          <section class="space-y-2">
            <div class="flex items-center gap-2 border-b pb-2 text-muted-foreground">
              <StickyNote class="h-3 w-3" />
              <h3 class="text-[10px] font-semibold tracking-widest uppercase">Remarks</h3>
            </div>
            <div class="space-y-4 px-1">
              {#if receiptData.notes}
                <p class="text-[11px] leading-relaxed text-muted-foreground">
                  {receiptData.notes}
                </p>
              {/if}
            </div>
          </section>
        {/if}
      </div>
    </Card.Content>

    <Card.Footer class="flex flex-col items-center gap-2 border-t bg-muted/10 pt-8 text-center">
      <div class="flex flex-col items-center gap-2">
        <span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
          >Generated by</span
        >
        <img src="/ha1.svg" alt="HA1 Logo" class="h-10 w-auto opacity-50 contrast-125 grayscale" />
      </div>
      <p class="mt-4 max-w-[350px] text-[10px] leading-relaxed text-muted-foreground">
        This document is electronically generated, does not require a signature, and is not valid
        for claim of input tax.
      </p>
      {#if qrDataUrl}
        <div class="rounded border bg-white p-1 shadow-sm">
          <img src={qrDataUrl} alt="Verification QR" class="h-16 w-16" />
        </div>
      {/if}
    </Card.Footer>
  </Card.Root>
  <div class="mb-2 flex flex-wrap gap-2 px-1">
    <Button
      onclick={() => handleAction("pdf", onDownloadPDF)}
      size="sm"
      variant="secondary"
      disabled={isExporting}
    >
      {#if isExporting && clickedAction === "pdf"}
        <Spinner class="mr-2 h-3.5 w-3.5" />
      {:else}
        <Download class="mr-2 h-3.5 w-3.5" />
      {/if}
      Export PDF
    </Button>
    <Button
      onclick={() => handleAction("image", onDownloadImage)}
      size="sm"
      variant="secondary"
      disabled={isExporting}
    >
      {#if isExporting && clickedAction === "image"}
        <Spinner class="mr-2 h-3.5 w-3.5" />
      {:else}
        <ImageIcon class="mr-2 h-3.5 w-3.5" />
      {/if}
      Save Image
    </Button>
    <Button
      onclick={() => handleAction("qr", onShareQR)}
      size="sm"
      variant="secondary"
      disabled={isExporting}
    >
      {#if isExporting && clickedAction === "qr"}
        <Spinner class="mr-2 h-3.5 w-3.5" />
      {:else}
        <QrCode class="mr-2 h-3.5 w-3.5" />
      {/if}
      Share QR
    </Button>
    <Button
      onclick={() => handleAction("link", onShareLink)}
      size="sm"
      variant="secondary"
      disabled={isExporting}
    >
      {#if isExporting && clickedAction === "link"}
        <Spinner class="mr-2 h-3.5 w-3.5" />
      {:else}
        <Share2 class="mr-2 h-3.5 w-3.5" />
      {/if}
      Share Link
    </Button>
  </div>
</div>
