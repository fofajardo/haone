<script lang="ts">
  import BrandingLogo from "$components/BrandingLogo.svelte";
  import { Button } from "$ui/button";
  import {
    Check,
    ImageIcon,
    Download,
    QrCode,
    ReceiptText,
    Share2,
    Smartphone,
    Wallet,
    NotepadTextIcon
  } from "@lucide/svelte";
  import { Spinner } from "$ui/spinner";
  import { brandingState } from "$state/branding.svelte";
  import type { ReceiptData } from "$lib/types";
  import { calculateTotal } from "$utils/math";
  import { formatAccounting, formatCurrency, formatDate } from "$utils/formatters";
  import { parseRef } from "$utils/parsers";
  import { translateMop, translatePeriod } from "$utils/translators";
  import { Badge } from "../ui/badge";

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
  const activeBranding = $derived(brandingState.profile);

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

  const receiptDetails = $derived([
    { label: "Date Issued", value: formatDate(receiptData.dateIssued) },
    { label: "Period", value: translatePeriod(receiptData.period) },
    { label: "Series Number", value: receiptData.seriesNumber, mono: true },
    { label: "Received From", value: receiptData.receivedFrom },
    { label: "Received By", value: receiptData.receivedBy },
    ...(receiptData.processor === "N/A"
      ? [
          { label: "Payment Processor", value: translateMop(receiptData.processor) },
          { label: "Reference Number", value: refInfo.reference, mono: true }
        ]
      : []),
    ...(refInfo.invoice
      ? [{ label: "InstaPay Invoice No.", value: refInfo.invoice, mono: true }]
      : [])
  ]);
</script>

<!-- SNIPPETS -->
{#snippet ticketHeader()}
  <div class="ticket-header-notch rounded-t-3xl bg-card pb-5 text-card-foreground">
    <div class="flex flex-col items-center px-7 pt-8 text-center">
      <!-- Checkmark Badge Icon -->
      <div class="relative mb-4 flex items-center justify-center">
        <div
          class="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground"
        >
          <Check class="h-8 w-8 stroke-3" />
        </div>
      </div>

      <!-- Success Headline & Subtitle -->
      <h2 class="text-2xl font-bold tracking-tight">Acknowledgement Receipt</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Issued by the {activeBranding.issuerName}
      </p>

      <!-- Amount Block -->
      <div class="mt-6 flex flex-col items-center">
        <span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Total Amount
        </span>
        <span class="mt-1 font-sans text-4xl font-extrabold tracking-tight">
          {formatCurrency(calculateTotal(receiptData.items))}
        </span>
      </div>
    </div>
  </div>
{/snippet}

{#snippet ticketDivider()}
  <div class="relative z-10 -my-px flex items-center justify-between">
    <div class="mx-7 w-full border-t-2 border-dashed border-border/80"></div>
  </div>
{/snippet}

{#snippet paymentDestination()}
  {#if receiptData.transactionType !== "WAIVED"}
    <div class="text-left">
      <div class="mb-2 text-xs font-semibold tracking-wider uppercase">Payment Destination</div>
      <div class="flex w-full items-center justify-between rounded-2xl bg-muted p-4 text-left">
        <div class="flex min-w-0 items-center gap-3.5">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-brand"
          >
            {#if receiptData.processor === "GCASH" || receiptData.processor === "MAYA"}
              <Smartphone />
            {:else if receiptData.processor === "CASH"}
              <Wallet />
            {:else}
              <ReceiptText />
            {/if}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold">
                {translateMop(receiptData.processor)}
              </span>
            </div>
            <p class="truncate text-xs">
              {formatDate(receiptData.paymentDate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet feeBreakdown()}
  <div class="space-y-4 text-sm">
    <div class="mb-2 text-xs font-semibold tracking-wider uppercase">Fees</div>
    <div class="space-y-2 rounded-2xl bg-muted p-3.5">
      <div class="space-y-1.5">
        {#each receiptData.items as item}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span>{item.name}</span>
              {#if item.amount < 0}
                <Badge variant="destructive" class="px-1.5 py-0 text-xs">
                  {receiptData.transactionType === "RECLASSIFY" ? "Reclassified" : "Refund"}
                </Badge>
              {/if}
            </div>
            <span class="font-semibold">
              {formatAccounting(item.amount)}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Remarks -->
    {#if receiptData.notes}
      <div class="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
        <NotepadTextIcon class="mt-0.5 h-4 w-4 shrink-0" />
        <p class="leading-relaxed wrap-break-word">
          {receiptData.notes}
        </p>
      </div>
    {/if}

    <!-- Waiver Note -->
    {#if receiptData.transactionType === "WAIVED"}
      <div class="rounded-xl bg-destructive/5 p-3 text-red-800">
        <p class="mt-0.5 text-sm font-semibold opacity-90">
          The above-mentioned amount has been waived for all intents and purposes, and no further
          claims shall be made in this regard.
        </p>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet metadataSection()}
  <div class="space-y-4 text-sm">
    <!-- Metadata Rows -->
    <div class="space-y-2 px-0.5 text-sm">
      {#each receiptDetails as detail}
        <div
          class="flex flex-col justify-between border-b border-border/40 py-1.5 md:flex-row md:items-center"
        >
          <span class="text-muted-foreground">{detail.label}</span>
          <span class="font-medium md:text-right {detail.mono ? 'font-mono md:text-xs' : ''}">
            {detail.value}
          </span>
        </div>
      {/each}
    </div>

    <!-- Bottom HA1 & QR Info -->
    <div class="flex items-center justify-between pt-1 pb-1">
      <div class="flex items-center gap-2">
        <img src="/ha1.svg" alt="HA1 Logo" class="h-6 w-auto opacity-50 contrast-125 grayscale" />
        <div class="text-xs leading-tight text-muted-foreground">
          <span>Generated by HAOne v{__APP_VERSION__}</span>
        </div>
      </div>
      {#if qrDataUrl}
        <img src={qrDataUrl} alt="Verification QR" class="h-16 w-16" />
      {/if}
    </div>
  </div>
{/snippet}

{#snippet scallopedBottom()}
  <div class="ticket-scallop -mt-px h-4 w-full bg-card"></div>
{/snippet}

{#snippet actionButtons()}
  <div class="mt-6 space-y-2.5">
    <!-- Primary Export Action -->
    <Button
      onclick={() => handleAction("pdf", onDownloadPDF)}
      size="lg"
      class="h-12 w-full bg-brand font-bold text-brand-foreground hover:bg-brand/90"
      disabled={isExporting}
      icon={isExporting && clickedAction === "pdf" ? Spinner : Download}
    >
      Export PDF
    </Button>

    <!-- Secondary Actions Bar -->
    <div class="grid grid-cols-3 gap-2">
      <Button
        onclick={() => handleAction("image", onDownloadImage)}
        size="sm"
        variant="secondary"
        disabled={isExporting}
        icon={isExporting && clickedAction === "image" ? Spinner : ImageIcon}
      >
        Save Image
      </Button>
      <Button
        onclick={() => handleAction("qr", onShareQR)}
        size="sm"
        variant="secondary"
        disabled={isExporting}
        icon={isExporting && clickedAction === "qr" ? Spinner : QrCode}
      >
        Share QR
      </Button>
      <Button
        onclick={() => handleAction("link", onShareLink)}
        size="sm"
        variant="secondary"
        disabled={isExporting}
        icon={isExporting && clickedAction === "link" ? Spinner : Share2}
      >
        Share Link
      </Button>
    </div>
  </div>
{/snippet}

<div class="mx-auto w-full max-w-md print:hidden">
  <!-- TOP BRAND TITLE -->
  <div class="mb-5 flex justify-center">
    <BrandingLogo class="h-16 w-auto object-contain" />
  </div>

  <!-- TICKET CARD CONTAINER -->
  <div class="relative drop-shadow-sm">
    {@render ticketHeader()}
    {@render ticketDivider()}

    <!-- BOTTOM CARD SECTION -->
    <div class="ticket-body-notch bg-card pt-5 text-card-foreground">
      <div class="space-y-4 px-7 pb-6">
        {@render paymentDestination()}
        {@render feeBreakdown()}
        {@render metadataSection()}
      </div>
    </div>

    {@render scallopedBottom()}
  </div>

  {@render actionButtons()}
</div>

<style>
  .ticket-header-notch {
    mask-image:
      radial-gradient(circle at 0px 100%, transparent 16px, black 16.5px),
      radial-gradient(circle at 100% 100%, transparent 16px, black 16.5px);
    mask-composite: intersect;
    -webkit-mask-image:
      radial-gradient(circle at 0px 100%, transparent 16px, black 16.5px),
      radial-gradient(circle at 100% 100%, transparent 16px, black 16.5px);
    -webkit-mask-composite: source-in;
  }

  .ticket-body-notch {
    mask-image:
      radial-gradient(circle at 0px 0px, transparent 16px, black 16.5px),
      radial-gradient(circle at 100% 0px, transparent 16px, black 16.5px);
    mask-composite: intersect;
    -webkit-mask-image:
      radial-gradient(circle at 0px 0px, transparent 16px, black 16.5px),
      radial-gradient(circle at 100% 0px, transparent 16px, black 16.5px);
    -webkit-mask-composite: source-in;
  }

  .ticket-scallop {
    mask-image: radial-gradient(circle at 14px 16px, transparent 10px, black 10.5px);
    mask-size: 28px 16px;
    mask-repeat: round no-repeat;
    -webkit-mask-image: radial-gradient(circle at 14px 16px, transparent 10px, black 10.5px);
    -webkit-mask-size: 28px 16px;
    -webkit-mask-repeat: round no-repeat;
  }
</style>
