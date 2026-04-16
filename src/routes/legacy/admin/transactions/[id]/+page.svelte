<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { brandingState } from "$lib/branding.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import {
    formatCurrency,
    formatAmount,
    formatAccounting,
    formatDate,
    translateMop,
    translatePeriod,
    parseCSVAmount,
    parseRef
  } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Label } from "$lib/components/ui/label";
  import {
    LoaderCircle,
    ChevronLeft,
    History,
    User,
    CreditCard,
    FileText,
    ShieldCheck,
    Link as LinkIcon,
    ArrowUpRight,
    ExternalLink
  } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  const id = $derived(page.params.id);

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
    WAS_AUDITED: 20,
    LEGACY_RECEIPT_URL: 21,
    ID: 22
  };

  let transaction = $state<string[] | null>(null);
  let creatorStNo = $state<string | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadTransaction() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "journal_general!A:W");
      // Find by ID (Index 22)
      const match = rows.find((row) => row[COL.ID] === id);

      if (!match) {
        error = "Transaction not found in the ledger.";
      } else {
        transaction = match;

        // Fetch accounts to resolve creator details
        try {
          const accRows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:AD");
          const creatorMatch = accRows.find(
            (r) => (r[0] || "").trim() === match[COL.CREATOR_EMAIL]
          );
          if (creatorMatch) {
            creatorStNo = creatorMatch[24] || null; // CE_STNO is index 24
          }
        } catch (e) {
          console.warn("Could not resolve creator student number:", e);
        }
      }
    } catch (e: any) {
      error = `Failed to retrieve audit data: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadTransaction);

  const fees = $derived(
    transaction
      ? [
          { name: "Water Fee", amount: parseCSVAmount(transaction[COL.WATER_FEE]) },
          { name: "Association Fee", amount: parseCSVAmount(transaction[COL.ASSOC_FEE]) },
          { name: "Miscellaneous", amount: parseCSVAmount(transaction[COL.MISC]) }
        ].filter((f) => f.amount !== 0)
      : []
  );

  const total = $derived(fees.reduce((sum: number, f: { amount: number }) => sum + f.amount, 0));

  const mopInfo = $derived(transaction ? parseRef(transaction[COL.MOP_REFNO]) : null);
</script>

<div class="space-y-6">
  <SubpageHeader title="View Transaction" href="/legacy/admin/transactions">
    {#snippet titleExtra()}
      {#if transaction && transaction[COL.WAS_AUDITED] === "TRUE"}
        <Badge class="border-transparent bg-primary px-2 py-0 text-[10px] font-black text-white"
          >AUDITED</Badge
        >
      {/if}
    {/snippet}
    {#snippet actions()}
      {#if transaction && transaction[COL.LEGACY_RECEIPT_URL]}
        <Button
          size="sm"
          class="h-8 gap-1.5 font-bold"
          href={transaction[COL.LEGACY_RECEIPT_URL]}
          target="_blank"
        >
          <ExternalLink class="h-3 w-3" />
          View Receipt
        </Button>
      {/if}
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading transaction..." />
  {:else if error}
    <Card.Root class="border-destructive/20 bg-destructive/5">
      <Card.Content class="flex flex-col items-center justify-center p-12 text-center">
        <History class="mb-4 h-12 w-12 text-destructive opacity-50" />
        <h2 class="text-lg font-bold text-destructive">{error}</h2>
        <Button variant="outline" class="mt-4" href="/legacy/admin/transactions"
          >Return to Journal</Button
        >
      </Card.Content>
    </Card.Root>
  {:else if transaction}
    <Card.Root class="mx-auto max-w-4xl">
      <Card.Header class="border-b bg-muted/5 pb-8">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="space-y-1">
            <span class="text-[10px] font-black tracking-widest text-primary uppercase"
              >{transaction[COL.TYPE]}</span
            >
            <div class="flex items-center gap-3">
              <h2 class="text-3xl font-black tracking-tight text-slate-900">
                {formatCurrency(total)}
              </h2>
              <div class="h-6 w-px bg-slate-200"></div>
              <span class="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                >{translateMop(transaction[COL.MOP])}</span
              >
            </div>
          </div>
          <div class="flex gap-10">
            <div class="flex flex-col items-end gap-1">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase">Date</Label>
              <p class="text-sm font-black text-slate-900">{formatDate(transaction[COL.DATE])}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase">Period</Label>
              <p class="text-sm leading-none font-black text-slate-900">
                {translatePeriod(transaction[COL.PERIOD])}
              </p>
            </div>
          </div>
        </div>
      </Card.Header>

      <Card.Content class="space-y-10 p-8">
        <!-- TOP: Parties -->
        <div class="grid gap-8 md:grid-cols-2">
          <div class="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
            <Label
              class="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase"
            >
              <User class="h-3.5 w-3.5" /> Account Holder
            </Label>
            <a
              href="/legacy/admin/residents/{transaction[COL.ST_NO]}"
              class="group block space-y-1 transition-all hover:opacity-80"
            >
              <p
                class="text-base font-black text-slate-900 transition-colors group-hover:text-primary"
              >
                {transaction[COL.ACCOUNT_NAME]}
              </p>
              <p class="text-xs font-medium text-slate-500">{transaction[COL.ACCOUNT]}</p>
              <p class="mt-1 font-mono text-[10px] font-bold text-primary">
                {transaction[COL.ST_NO]}
              </p>
            </a>
          </div>
          <div class="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
            <Label
              class="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase"
            >
              <ShieldCheck class="h-3.5 w-3.5" /> Entry Creator
            </Label>
            {#if creatorStNo}
              <a
                href="/legacy/admin/residents/{creatorStNo}"
                class="group block space-y-1 transition-all hover:opacity-80"
              >
                <p
                  class="text-base font-black text-slate-900 transition-colors group-hover:text-primary"
                >
                  {transaction[COL.CREATOR_NAME]}
                </p>
                <p class="text-xs font-medium text-slate-500">{transaction[COL.CREATOR_EMAIL]}</p>
                <p class="mt-1 font-mono text-[10px] font-bold text-primary">
                  {creatorStNo}
                </p>
              </a>
            {:else}
              <div class="space-y-1">
                <p class="text-base font-black text-slate-900">{transaction[COL.CREATOR_NAME]}</p>
                <p class="text-xs font-medium text-slate-500">{transaction[COL.CREATOR_EMAIL]}</p>
              </div>
            {/if}
          </div>
        </div>

        <!-- MID: Ledger Details -->
        <div class="grid gap-12 md:grid-cols-2">
          <div class="space-y-6">
            <Label class="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
              >Particulars</Label
            >
            <div class="space-y-3">
              {#each fees as fee}
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span class="text-sm font-semibold text-slate-600">{fee.name}</span>
                  <span class="font-mono text-sm font-black text-slate-900"
                    >{formatAccounting(fee.amount)}</span
                  >
                </div>
              {/each}
              <div class="flex items-center justify-between pt-2">
                <span class="text-xs font-black text-primary uppercase">TOTAL</span>
                <span class="text-xl font-black text-slate-900">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <Label class="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
              >Reference Identifiers</Label
            >
            <div class="grid grid-cols-1 gap-6">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                  >Series Number</Label
                >
                <p class="font-mono text-sm leading-none font-black text-primary">
                  {transaction[COL.PR_REFNO] || "—"}
                </p>
              </div>
              {#if mopInfo}
                <div class="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div class="space-y-1.5">
                    <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                      >Reference Number</Label
                    >
                    <p class="font-mono text-[11px] leading-none font-bold text-slate-700">
                      {mopInfo.reference}
                    </p>
                  </div>
                  {#if mopInfo.invoice}
                    <div class="space-y-1.5">
                      <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                        >InstaPay Invoice Number</Label
                      >
                      <p class="font-mono text-[11px] leading-none font-bold text-slate-700">
                        {mopInfo.invoice}
                      </p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- BOTTOM: Remarks -->
        <div class="space-y-6 border-t border-slate-100 pt-8">
          <div class="grid gap-8 md:grid-cols-2">
            <div class="space-y-3">
              <Label class="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                >Public Remarks</Label
              >
              <div
                class="rounded-xl border border-slate-100 bg-slate-50/50 p-5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600"
              >
                {transaction[COL.NOTES] || "No public remarks provided."}
              </div>
            </div>
            {#if transaction[COL.NOTES_PRIVATE]}
              <div class="space-y-3">
                <Label class="text-[10px] font-black tracking-widest text-primary uppercase"
                  >Private NOTES</Label
                >
                <div
                  class="rounded-xl border border-primary/10 bg-primary/5 p-5 text-sm leading-relaxed text-slate-700 italic"
                >
                  {transaction[COL.NOTES_PRIVATE]}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>
