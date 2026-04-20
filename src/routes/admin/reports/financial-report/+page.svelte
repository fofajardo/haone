<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { auth } from "$lib/auth.svelte";
  import AccountAutocomplete from "$lib/components/AccountAutocomplete.svelte";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { HandCoins, RefreshCcw } from "lucide-svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { mapRowToResident, mapRowToJournal } from "$lib/resident-logic";
  import { parseDateWeight, translatePeriod, pluralize } from "$lib/receipt-utils";
  import { exportFinancialReportPDF } from "$lib/financial-report-pdf";
  import type { JournalRecord, ResidentRecord } from "$lib/schemas";

  let isLoading = $state(true);
  let isProcessing = $state(false);
  let error = $state<string | null>(null);
  let allJournal = $state<JournalRecord[]>([]);
  let allAccounts = $state<ResidentRecord[]>([]);
  let journal = $derived(
    allJournal.filter((j) => j.period === uiSettings.currentSemester.trim() && j.type !== "EOS")
  );
  let accounts = $derived(
    allAccounts.filter((r) => r.period === uiSettings.currentSemester.trim())
  );
  let allAccountsForAutocomplete = $state<ResidentRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let availableMops = $state<{ value: string; label: string }[]>([]);

  // Form State
  let issuedBy = $state(auth.user?.name || "");
  let issuedByEmail = $state(auth.user?.email || "");
  let assessedBy = $state("");
  let assessedByEmail = $state("");
  let certifiedBy = $state("");
  let certifiedByEmail = $state("");
  let periodStart = $state("");
  let periodEnd = $state("");

  // Auto-Period based on filtered journal
  $effect(() => {
    if (journal.length > 0) {
      const sortedDates = [...journal]
        .map((j) => j.date)
        .filter(Boolean)
        .sort((a, b) => parseDateWeight(a) - parseDateWeight(b));

      if (sortedDates.length > 0) {
        periodStart = sortedDates[0];
        periodEnd = sortedDates[sortedDates.length - 1];
      }
    }
  });

  async function loadData() {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    error = null;

    try {
      const currentSem = uiSettings.currentSemester.trim();

      // Fetch Journal
      const journalRows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:W"
      );
      allJournal = journalRows.slice(1).map((row, idx) => {
        const res = mapRowToJournal(row, idx);
        return {
          ...res,
          dateWeight: parseDateWeight(res.date)
        };
      });

      // Fetch Accounts
      const accountRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:Z");
      const mappedAccounts = accountRows
        .slice(1)
        .map(mapRowToResident)
        .filter((r) => r.email && r.email !== "_vacant");

      allAccounts = mappedAccounts;
      allAccountsForAutocomplete = mappedAccounts;

      // Fetch Constants (Transaction Types & MOPs)
      const constRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C");
      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));

      availableMops = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("MOP_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));

      // Auto-Period
      const sortedDates = journal
        .map((j) => j.date)
        .filter(Boolean)
        .sort((a, b) => parseDateWeight(a) - parseDateWeight(b));

      if (sortedDates.length > 0) {
        periodStart = sortedDates[0];
        periodEnd = sortedDates[sortedDates.length - 1];
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  async function handleGenerate() {
    isProcessing = true;
    try {
      const pStart = new Date(periodStart).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      const pEnd = new Date(periodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });

      await exportFinancialReportPDF({
        journal,
        accounts,
        semester: translatePeriod(uiSettings.currentSemester),
        brandingKey: brandingState.selectedKey,
        issuedBy: issuedBy ? `${issuedBy} <${issuedByEmail}>` : "—",
        assessedBy: assessedBy ? `${assessedBy} <${assessedByEmail}>` : "—",
        certifiedBy: certifiedBy ? `${certifiedBy} <${certifiedByEmail}>` : "—",
        periodCovered: `${pStart} – ${pEnd}`,
        transactionTypes,
        availableMops
      });
    } catch (e: any) {
      alert("Failed to generate report: " + e.message);
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="space-y-6 pb-20">
  <SubpageHeader title="Financial Report" isTopLevel={true}>
    {#snippet actions()}
      <Button variant="outline" size="sm" onclick={() => loadData()} disabled={isLoading}>
        <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
        <span class="hidden sm:inline">Refresh</span>
      </Button>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Analyzing ledger data…" />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}>Try Again</Button>
    </ErrorView>
  {:else}
    <div class="mx-auto max-w-2xl space-y-8 {isProcessing ? 'pointer-events-none opacity-50' : ''}">
      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >1. Scope</Label
        >
        <div class="grid gap-6 rounded-2xl border bg-card p-6">
          <div class="space-y-4">
            <div class="space-y-2">
              <TermFilter />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                  >Period Start</Label
                >
                <Input type="date" bind:value={periodStart} class="h-10 text-sm font-medium" />
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-bold text-muted-foreground uppercase"
                  >Period End</Label
                >
                <Input type="date" bind:value={periodEnd} class="h-10 text-sm font-medium" />
              </div>
            </div>
          </div>
          <div class="rounded-xl bg-muted/30 p-4 text-xs">
            Found <span class="font-bold text-foreground"
              >{pluralize(journal.length, "transaction", "transactions")}</span
            >
            and
            <span class="font-bold text-foreground"
              >{pluralize(accounts.length, "resident record", "resident records")}</span
            >.
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >2. Signatories</Label
        >
        <div class="grid gap-6 rounded-2xl border bg-card p-6">
          <!-- Issued By -->
          <div class="space-y-3">
            <AccountAutocomplete
              label="Issued By"
              accounts={allAccountsForAutocomplete}
              bind:value={issuedBy}
              filter={(a) => a.period === uiSettings.currentSemester}
              onSelect={(a) => {
                issuedBy = a.name;
                issuedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-sm font-bold text-foreground/80"
                  >{issuedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-[10px] text-muted-foreground"
                  >{issuedByEmail || "No email"}</span
                >
              </div>
            </div>
          </div>

          <!-- Assessed By -->
          <div class="space-y-3">
            <AccountAutocomplete
              label="Assessed By"
              accounts={allAccountsForAutocomplete}
              bind:value={assessedBy}
              filter={(a) => a.period === uiSettings.currentSemester}
              onSelect={(a) => {
                assessedBy = a.name;
                assessedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span
                  class="mb-1 text-[10px] leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-xs font-bold text-foreground/80"
                  >{assessedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-[9px] text-muted-foreground"
                  >{assessedByEmail || "No email"}</span
                >
              </div>
            </div>
          </div>

          <!-- Certified By -->
          <div class="space-y-3">
            <AccountAutocomplete
              label="Certified By"
              accounts={allAccountsForAutocomplete}
              bind:value={certifiedBy}
              filter={(a) => a.period === uiSettings.currentSemester}
              onSelect={(a) => {
                certifiedBy = a.name;
                certifiedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span
                  class="mb-1 text-[10px] leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-xs font-bold text-foreground/80"
                  >{certifiedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-[9px] text-muted-foreground"
                  >{certifiedByEmail || "No email"}</span
                >
              </div>
            </div>
          </div>
        </div>
      </section>

      <Button
        size="lg"
        class="w-full gap-3 font-bold"
        onclick={handleGenerate}
        disabled={isProcessing || journal.length === 0}
      >
        {#if isProcessing}
          <RefreshCcw class="h-5 w-5 animate-spin" />
          Processing…
        {:else}
          <HandCoins class="h-5 w-5" />
          Generate PDF Report
        {/if}
      </Button>
    </div>
  {/if}
</div>
