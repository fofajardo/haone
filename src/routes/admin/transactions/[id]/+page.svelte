<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { uiSettings } from "$state/settings.svelte";
  import {
    fetchJournalEntries,
    deleteJournalEntry,
    updateJournalEntry,
    batchAuditEntries
  } from "$api/controllers/journal-controller";
  import { fetchTransactionTypes } from "$api/controllers/constants-controller";
  import { formatCurrency, formatAccounting, formatDate } from "$utils/formatters";
  import { translateMop, translatePeriod, translateType } from "$utils/translators";
  import { parseRef } from "$utils/parsers";
  import * as Card from "$ui/card";
  import * as AlertDialog from "$ui/alert-dialog";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Label } from "$ui/label";
  import {
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
    Lock,
    TriangleAlert
  } from "@lucide/svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";

  const id = $derived(page.params.id);

  import { JOURNAL_COL as JOR, type JournalRecord } from "$lib/types";
  import { mapRowToJournal, fetchResidents } from "$api/controllers/resident-controller";

  let transaction = $state<JournalRecord | null>(null);
  let creatorResidentId = $state<string | null>(null);
  let accountResidentId = $state<string | null>(null);
  let creatorStNo = $state<string | null>(null);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);
  let isDeleting = $state(false);
  let error = $state<string | null>(null);
  let rowIndex = $state<number | null>(null);
  let isAuditing = $state(false);
  let isDialogOpen = $state(false);
  let isSystemAlertOpen = $state(false);

  async function handleMarkAudited() {
    if (!transaction?.id) {
      return;
    }
    isAuditing = true;
    try {
      await batchAuditEntries([transaction.id]);
      await loadTransaction();
    } catch (e: any) {
      error = `Audit update failed: ${e.message}`;
    } finally {
      isAuditing = false;
    }
  }

  async function loadTransaction() {
    isLoading = true;
    error = null;

    try {
      const [entries, types] = await Promise.all([
        fetchJournalEntries(undefined, undefined),
        fetchTransactionTypes(false)
      ]);
      const list = Array.isArray(entries) ? entries : entries.items;
      const idx = list.findIndex((row, i) => row.id === id || (i + 1).toString() === id);
      const match = list[idx];

      if (!match) {
        error = "Transaction not found in the ledger.";
      } else {
        rowIndex = idx;
        transaction = match;

        try {
          const allResidents = await fetchResidents();
          const creatorMatch = allResidents.find((r) => r.email === match.creator);
          if (creatorMatch) {
            creatorStNo = creatorMatch.stno;
            creatorResidentId = creatorMatch.residentId;
          }
          const accountMatch = allResidents.find(
            (r) =>
              (match.stno && r.stno === match.stno) ||
              (match.account && r.email.toLowerCase() === match.account.toLowerCase())
          );
          if (accountMatch) {
            accountResidentId = accountMatch.residentId;
          }
        } catch (e) {
          console.warn("Could not resolve resident info:", e);
        }

        transactionTypes = types;
      }
    } catch (e: any) {
      error = `Failed to retrieve audit data: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete() {
    if (!transaction?.id) return;

    isDialogOpen = false;
    isDeleting = true;
    try {
      await deleteJournalEntry(transaction.id);
      goto("/admin/transactions");
    } catch (e: any) {
      error = `Deletion failed: ${e.message}`;
      window.scrollTo(0, 0);
    } finally {
      isDeleting = false;
    }
  }

  onMount(() => {
    pageState.title = "View Transaction";
    loadTransaction();
  });

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

  const isSpecialType = $derived.by(() => {
    if (!transaction) {
      return false;
    }
    const type = transaction.type.toUpperCase();
    return (
      type === "TRANSFER_FROM" ||
      type === "TRANSFER_TO" ||
      type === "CARRYOVER" ||
      type === "PMT_CARRYOVER"
    );
  });

  const headerColors = $derived(() => {
    if (!transaction) return "bg-muted/5";
    const mop = (transaction.mop || "").toUpperCase();
    if (mop === "GCASH") return "bg-blue-500/10 dark:bg-blue-600/15 border-blue-500/20";
    if (mop === "MAYA") return "bg-emerald-500/10 dark:bg-emerald-600/15 border-emerald-500/20";
    return "bg-muted/5";
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="View Transaction"
    actions={[
      ...(transaction && !transaction.wasAudited
        ? [
            {
              label: "Delete",
              variant: "destructive" as const,
              onclick: () => {
                isDialogOpen = true;
              },
              isLoading: isDeleting,
              icon: Trash2
            },
            {
              label: "Mark as Audited",
              variant: "outline" as const,
              onclick: handleMarkAudited,
              isLoading: isAuditing,
              icon: ShieldCheck
            },
            {
              label: "Edit",
              variant: (transaction?.receiptUrl ? "secondary" : "default") as const,
              href: `/admin/transactions/${id}/edit`,
              disabled: isDeleting,
              icon: Pencil
            }
          ]
        : []),
      ...(transaction && transaction.receiptUrl
        ? [
            {
              label: "View Receipt",
              href: transaction.receiptUrl,
              target: "_blank",
              icon: ExternalLink
            }
          ]
        : [])
    ]}
  >
    {#snippet titleExtra()}
      {#if transaction && transaction.wasAudited === true}
        <Badge>AUDITED</Badge>
      {/if}
    {/snippet}
  </ContentHeader>

  <AlertDialog.Root bind:open={isDialogOpen}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Confirm Deletion</AlertDialog.Title>
        <AlertDialog.Description class="space-y-3">
          <span
            >This will permanently delete this transaction record from the ledger. This action
            cannot be undone.</span
          >
          {#if isSpecialType}
            <div
              class="mt-2 flex animate-in items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-foreground duration-200 fade-in slide-in-from-top-1"
            >
              <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p class="mb-1 font-bold tracking-wider uppercase">Special Transaction Type</p>
                This is a special transaction type ({transaction?.type}). Deleting this row requires
                manually deleting any related or balancing ledger entries to maintain consistency.
              </div>
            </div>
          {/if}
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

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-4" href="/admin/transactions">Return to Ledger</Button>
    </ErrorView>
  {:else if transaction}
    <Card.Root class="mx-auto max-w-4xl overflow-hidden p-0">
      <Card.Header class="border-b p-8 transition-colors {headerColors()}">
        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="space-y-1">
            <span class="text-xs font-bold tracking-widest text-primary uppercase"
              >{translateType(transaction.type, transactionTypes)}</span
            >
            <div class="flex items-center gap-3">
              <h2 class="text-3xl font-bold tracking-tight text-foreground">
                {formatCurrency(total)}
              </h2>
            </div>
            <div
              class="flex items-center gap-1.5 font-bold tracking-widest text-foreground uppercase"
            >
              <span class="text-xs">{translateMop(transaction.mop)}</span>
            </div>
          </div>
          <div class="flex gap-10">
            <div class="flex flex-col items-end gap-1">
              <Label class="text-xs font-bold text-muted-foreground uppercase">Date</Label>
              <p class="text-sm font-bold text-foreground">{formatDate(transaction.date)}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <Label class="text-xs font-bold text-muted-foreground uppercase">Term</Label>
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
          {#if transaction.creator && !transaction.creator.startsWith("_") && creatorResidentId}
            <a
              href="/admin/users/{creatorResidentId}"
              class="group block space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
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
                {#if creatorStNo}
                  <p class="mt-1 font-mono text-xs font-bold text-muted-foreground/80">
                    {creatorStNo}
                  </p>
                {/if}
              </div>
            </a>
          {:else if transaction.creator && transaction.creator.startsWith("_")}
            <button
              onclick={() => (isSystemAlertOpen = true)}
              class="group block w-full cursor-pointer space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
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
                class="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase"
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
                {#if creatorStNo}
                  <p class="mt-1 font-mono text-xs font-bold text-muted-foreground/80">
                    {creatorStNo}
                  </p>
                {/if}
              </div>
            </div>
          {/if}

          {#if !transaction.account?.startsWith("_") && accountResidentId}
            <a
              href="/admin/users/{accountResidentId}"
              class="group block space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
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
                {#if transaction.stno}
                  <p class="mt-1 font-mono text-xs font-bold text-muted-foreground/80">
                    {transaction.stno}
                  </p>
                {/if}
              </div>
            </a>
          {:else if transaction.account?.startsWith("_")}
            <button
              onclick={() => (isSystemAlertOpen = true)}
              class="group block w-full cursor-pointer space-y-4 rounded-xl border border-border bg-muted/20 p-5 transition-all hover:border-primary/50 hover:bg-muted/40"
            >
              <Label
                class="flex cursor-pointer items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-primary"
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
                class="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase"
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
                {#if transaction.stno}
                  <p class="mt-1 font-mono text-xs font-bold text-muted-foreground/80">
                    {transaction.stno}
                  </p>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- MID: Ledger Details -->
        <div class="grid gap-12 md:grid-cols-2">
          <div class="space-y-6">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
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
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <Hash class="h-3 w-3" /> Reference Identifiers
            </Label>
            <div class="grid grid-cols-1 gap-6">
              <div class="space-y-1.5">
                <Label class="text-xs font-bold text-muted-foreground uppercase"
                  >Series Number</Label
                >
                <p class="font-mono text-sm leading-none font-bold text-primary">
                  {transaction.prRefNo || "—"}
                </p>
              </div>
              {#if mopInfo}
                <div class="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <div class="space-y-1.5">
                    <Label class="text-xs font-bold text-muted-foreground uppercase"
                      >Reference Number</Label
                    >
                    <p class="font-mono text-sm leading-none font-bold text-foreground/80">
                      {mopInfo.reference}
                    </p>
                  </div>
                  {#if mopInfo.invoice}
                    <div class="space-y-1.5">
                      <Label class="text-xs font-bold text-muted-foreground uppercase"
                        >InstaPay Invoice Number</Label
                      >
                      <p class="font-mono text-sm leading-none font-bold text-foreground/80">
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
                    class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
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
                    class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-primary uppercase"
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
