<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { brandingState } from "$lib/branding.svelte";
  import { fetchSheetRowsRaw, deleteSheetRow, deleteRowFromCache } from "$lib/google-sheets";
  import {
    formatCurrency,
    formatAccounting,
    formatDate,
    translateMop,
    translatePeriod,
    translateType,
    parseRef
  } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Label } from "$lib/components/ui/label";
  import {
    LoaderCircle,
    History,
    User,
    ShieldCheck,
    ExternalLink,
    Pencil,
    Trash2,
    Banknote,
    Smartphone,
    ListFilter as ListFilterIcon,
    Hash,
    Info,
    Lock
  } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  const id = $derived(page.params.id);

  import { JOURNAL_COL as JOR, ACCOUNT_COL as ACC, type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal } from "$lib/resident-logic";

  let transaction = $state<JournalRecord | null>(null);
  let creatorStNo = $state<string | null>(null);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);
  let isDeleting = $state(false);
  let error = $state<string | null>(null);
  let rowIndex = $state<number | null>(null);
  let isDialogOpen = $state(false);
  let isSystemAlertOpen = $state(false);

  async function loadTransaction() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "journal_general!A:W");
      const idx = rows.findIndex((row, i) => row[JOR.ID] === id || (i + 1).toString() === id);
      const match = rows[idx];

      if (!match) {
        error = "Transaction not found in the ledger.";
      } else {
        rowIndex = idx;
        transaction = mapRowToJournal(match);

        // Fetch accounts to resolve creator details
        try {
          const accRows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:AD");
          const creatorMatch = accRows.find(
            (r) => (r[ACC.EMAIL] || "").trim() === match[JOR.CREATOR]
          );
          if (creatorMatch) {
            creatorStNo = creatorMatch[ACC.STNO] || null;
          }
        } catch (e) {
          console.warn("Could not resolve creator student number:", e);
        }

        // 3. Fetch Transaction Types
        const constRows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "constants!A:C");
        transactionTypes = constRows
          .slice(1)
          .filter((r) => (r[0] || "").startsWith("PMT_"))
          .map((r) => ({
            value: r[1] || r[0],
            label: r[2] || r[1] || r[0]
          }));
      }
    } catch (e: any) {
      error = `Failed to retrieve audit data: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete() {
    if (rowIndex === null || !brandingState.spreadsheetId) return;

    isDialogOpen = false;
    isDeleting = true;
    try {
      await deleteSheetRow(brandingState.spreadsheetId, "journal_general", rowIndex);
      deleteRowFromCache(brandingState.spreadsheetId, "journal_general!A:W", rowIndex);
      goto("/admin/transactions");
    } catch (e: any) {
      error = `Deletion failed: ${e.message}`;
      window.scrollTo(0, 0);
    } finally {
      isDeleting = false;
    }
  }

  onMount(loadTransaction);

  const fees = $derived(
    transaction
      ? [
          { name: "Water Fee", amount: transaction.water },
          { name: "Association Fee", amount: transaction.assoc },
          { name: "Miscellaneous", amount: transaction.misc }
        ].filter((f) => f.amount !== 0)
      : []
  );

  const total = $derived(fees.reduce((sum: number, f: { amount: number }) => sum + f.amount, 0));
  const mopInfo = $derived(transaction ? parseRef(transaction.mopRefNo) : null);

  const headerColors = $derived(() => {
    if (!transaction) return "bg-muted/5";
    const mop = (transaction.mop || "").toUpperCase();
    if (mop === "GCASH") return "bg-blue-500/10 dark:bg-blue-600/15 border-blue-500/20";
    if (mop === "MAYA") return "bg-emerald-500/10 dark:bg-emerald-600/15 border-emerald-500/20";
    return "bg-muted/5";
  });
</script>

<div class="space-y-6">
  <SubpageHeader title="View Transaction">
    {#snippet titleExtra()}
      {#if transaction && transaction.wasAudited === true}
        <Badge class="border-transparent bg-primary px-2 py-0 text-[10px] font-black text-white"
          >AUDITED</Badge
        >
      {/if}
    {/snippet}
    {#snippet actions()}
      {#if transaction && !transaction.wasAudited}
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 font-bold"
            href="/admin/transactions/{id}/edit"
            disabled={isDeleting}
          >
            <Pencil class="h-3 w-3" />
            Edit
          </Button>

          <AlertDialog.Root bind:open={isDialogOpen}>
            <AlertDialog.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 font-bold"
                  disabled={isDeleting}
                >
                  {#if isDeleting}
                    <LoaderCircle class="h-3 w-3 animate-spin" />
                  {:else}
                    <Trash2 class="h-3 w-3" />
                  {/if}
                  Delete
                </Button>
              {/snippet}
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Confirm Deletion</AlertDialog.Title>
                <AlertDialog.Description>
                  This will permanently delete this transaction record from the ledger. This action
                  cannot be undone.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action
                  onclick={handleDelete}
                  class="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Proceed
                </AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
        </div>
      {/if}
      {#if transaction && transaction.receiptUrl}
        <Button
          size="sm"
          class="h-8 gap-1.5 font-bold"
          href={transaction.receiptUrl}
          target="_blank"
        >
          <ExternalLink class="h-3 w-3" />
          View Receipt
        </Button>
      {/if}
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading transaction…" />
  {:else if error}
    <Card.Root class="border-border bg-muted/30">
      <Card.Content class="flex flex-col items-center justify-center p-12 text-center">
        <History class="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
        <h2 class="text-lg font-bold text-foreground">{error}</h2>
        <Button variant="outline" class="mt-4" href="/admin/transactions">Return to Journal</Button>
      </Card.Content>
    </Card.Root>
  {:else if transaction}
    <Card.Root class="mx-auto max-w-4xl overflow-hidden p-0">
      <Card.Header class="border-b p-8 transition-colors {headerColors()}">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="space-y-1">
            <span class="text-[10px] font-bold tracking-widest text-primary uppercase"
              >{translateType(transaction.type, transactionTypes)}</span
            >
            <div class="flex items-center gap-3">
              <h2 class="text-3xl font-bold tracking-tight text-foreground">
                {formatCurrency(total)}
              </h2>
              <div class="h-6 w-px bg-border"></div>
              <div
                class="flex items-center gap-1.5 font-bold tracking-widest text-foreground uppercase"
              >
                {#if (transaction.mop || "").toUpperCase() === "CASH"}
                  <Banknote class="h-3.5 w-3.5 opacity-60" />
                {:else if (transaction.mop || "").toUpperCase() === "GCASH" || (transaction.mop || "").toUpperCase() === "MAYA"}
                  <Smartphone class="h-3.5 w-3.5 opacity-60" />
                {/if}
                <span class="text-[10px]">{translateMop(transaction.mop)}</span>
              </div>
            </div>
          </div>
          <div class="flex gap-10">
            <div class="flex flex-col items-end gap-1">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase">Date</Label>
              <p class="text-sm font-bold text-foreground">{formatDate(transaction.date)}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <Label class="text-[10px] font-bold text-muted-foreground uppercase">Term</Label>
              <p class="text-sm font-bold text-foreground">
                {translatePeriod(transaction.period)}
              </p>
            </div>
          </div>
        </div>
      </Card.Header>

      <Card.Content class="space-y-10 px-8 pb-8">
        <!-- TOP: Parties -->
        <div class="grid gap-8 md:grid-cols-2">
          {#if transaction.creator && !transaction.creator.startsWith("_") && creatorStNo}
            <a
              href="/admin/residents/{creatorStNo}"
              class="group block space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
              >
                <ShieldCheck class="h-3.5 w-3.5" /> Recorder
              </Label>
              <div class="space-y-1 text-left">
                <p class="text-base font-bold text-foreground">
                  {transaction.creatorName}
                </p>
                <p class="text-xs font-medium text-muted-foreground">
                  {transaction.creator}
                </p>
                <p class="mt-1 font-mono text-[10px] font-bold text-muted-foreground/80">
                  {creatorStNo}
                </p>
              </div>
            </a>
          {:else if transaction.creator && transaction.creator.startsWith("_")}
            <button
              onclick={() => (isSystemAlertOpen = true)}
              class="group block w-full cursor-pointer space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
              >
                <ShieldCheck class="h-3.5 w-3.5" /> Recorder
              </Label>
              <div class="space-y-1 text-left">
                <p class="text-base font-bold text-foreground">
                  {transaction.creatorName}
                </p>
                <p class="text-xs font-medium text-muted-foreground">
                  {transaction.creator}
                </p>
              </div>
            </button>
          {:else}
            <div class="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
              <Label
                class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
              >
                <ShieldCheck class="h-3.5 w-3.5" /> Recorder
              </Label>
              <div class="space-y-1">
                <p class="text-base font-bold text-foreground">
                  {transaction.creatorName}
                </p>
                <p class="text-xs font-medium text-muted-foreground">
                  {transaction.creator}
                </p>
              </div>
            </div>
          {/if}

          {#if !transaction.account?.startsWith("_")}
            <a
              href="/admin/residents/{transaction.stno}"
              class="group block space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
              >
                <User class="h-3.5 w-3.5" /> Account
              </Label>
              <div class="space-y-1 text-left">
                <p class="text-base font-bold text-foreground">
                  {transaction.name}
                </p>
                <p class="text-xs font-medium text-muted-foreground">
                  {transaction.account}
                </p>
                <p class="mt-1 font-mono text-[10px] font-bold text-muted-foreground/80">
                  {transaction.stno}
                </p>
              </div>
            </a>
          {:else if transaction.account?.startsWith("_")}
            <button
              onclick={() => (isSystemAlertOpen = true)}
              class="group block w-full cursor-pointer space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
              >
                <User class="h-3.5 w-3.5" /> Account
              </Label>
              <div class="space-y-1 text-left">
                <p class="text-base font-bold text-foreground">
                  {transaction.name}
                </p>
                <p class="text-xs font-medium text-muted-foreground">
                  {transaction.account}
                </p>
              </div>
            </button>
          {:else}
            <div class="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
              <Label
                class="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
              >
                <User class="h-3.5 w-3.5" /> Account
              </Label>
              <div class="space-y-1">
                <p class="text-base font-bold text-foreground">
                  {transaction.name}
                </p>
                <p class="text-xs font-medium text-muted-foreground">
                  {transaction.account}
                </p>
              </div>
            </div>
          {/if}
        </div>

        <!-- MID: Ledger Details -->
        <div class="grid gap-12 md:grid-cols-2">
          <div class="space-y-6">
            <Label
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
            >
              <ListFilterIcon class="h-3 w-3" /> Particulars
            </Label>
            <div class="space-y-3">
              {#each fees as fee}
                <div class="flex items-center justify-between border-b border-border pb-3">
                  <span class="text-sm font-semibold text-muted-foreground">{fee.name}</span>
                  <span class="font-mono text-sm font-bold text-foreground"
                    >{formatAccounting(fee.amount)}</span
                  >
                </div>
              {/each}
              <div class="flex items-center justify-between pt-2">
                <span class="text-xs font-bold text-primary uppercase">TOTAL</span>
                <span class="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <Label
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
            >
              <Hash class="h-3 w-3" /> Reference Identifiers
            </Label>
            <div class="grid grid-cols-1 gap-6">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                  >Series Number</Label
                >
                <p class="font-mono text-sm leading-none font-bold text-primary">
                  {transaction.prRefNo || "—"}
                </p>
              </div>
              {#if mopInfo}
                <div class="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <div class="space-y-1.5">
                    <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                      >Reference Number</Label
                    >
                    <p class="font-mono text-[11px] leading-none font-bold text-foreground/80">
                      {mopInfo.reference}
                    </p>
                  </div>
                  {#if mopInfo.invoice}
                    <div class="space-y-1.5">
                      <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                        >InstaPay Invoice Number</Label
                      >
                      <p class="font-mono text-[11px] leading-none font-bold text-foreground/80">
                        {mopInfo.invoice}
                      </p>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>

        {#if transaction.notes?.trim() || transaction.notesPrivate?.trim()}
          <!-- BOTTOM: Remarks -->
          <div class="space-y-6 border-t border-border pt-8">
            <div class="grid gap-8 md:grid-cols-2">
              {#if transaction.notes?.trim()}
                <div class="space-y-3">
                  <Label
                    class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                  >
                    <Info class="h-3 w-3" /> Public Remarks
                  </Label>
                  <div
                    class="rounded-xl border border-border bg-muted/20 p-5 text-sm leading-relaxed text-muted-foreground"
                  >
                    {transaction.notes}
                  </div>
                </div>
              {/if}
              {#if transaction.notesPrivate?.trim()}
                <div class="space-y-3">
                  <Label
                    class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-primary uppercase"
                  >
                    <Lock class="h-3 w-3" /> Private Notes
                  </Label>
                  <div
                    class="rounded-xl border border-primary/10 bg-primary/5 p-5 text-sm leading-relaxed text-foreground/80 italic"
                  >
                    {transaction.notesPrivate}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</div>

<AlertDialog.Root bind:open={isSystemAlertOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>System Account</AlertDialog.Title>
      <AlertDialog.Description>
        This entry was generated by a system process or a legacy migration. It does not have a
        corresponding resident profile.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (isSystemAlertOpen = false)}>Close</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
