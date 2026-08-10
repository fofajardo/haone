<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$state/branding.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { auth } from "$state/auth.svelte";
  import AccountAutocomplete from "$components/AccountAutocomplete.svelte";
  import TermFilter from "$components/TermFilter.svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { HandCoins, RefreshCcw } from "@lucide/svelte";
  import { translatePeriod } from "$utils/translators";
  import { pluralize } from "$utils/formatters";
  import { getJournalDateRange } from "$utils/parsers";
  import {
    exportFinancialReportPDF,
    fetchFinancialReportData
  } from "$reports/financial-report-pdf";
  import type { JournalRecord, ResidentRecord } from "$lib/types";

  let isLoading = $state(true);
  let isProcessing = $state(false);
  let error = $state<string | null>(null);
  let allJournal = $state<JournalRecord[]>([]);
  let allAccounts = $state<ResidentRecord[]>([]);
  let journal = $derived(
    allJournal.filter((j) => {
      return j.period === uiSettings.currentTerm.trim() && j.type !== "EOS";
    })
  );
  let accounts = $derived(
    allAccounts.filter((r) => {
      return r.period === uiSettings.currentTerm.trim();
    })
  );
  let allAccountsForAutocomplete = $state<ResidentRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let availableMops = $state<{ value: string; label: string }[]>([]);

  // Form State
  let issuedBy = $state(auth.displayName || "");
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
      const range = getJournalDateRange(journal);
      if (range.start && range.end) {
        periodStart = range.start;
        periodEnd = range.end;
      }
    }
  });

  async function loadData() {
    isLoading = true;
    error = null;

    try {
      const data = await fetchFinancialReportData(uiSettings.accountingWorkbookId);
      allJournal = data.allJournal;
      allAccounts = data.allAccounts;
      allAccountsForAutocomplete = data.allAccounts;
      transactionTypes = data.transactionTypes;
      availableMops = data.availableMops;

      // Auto-Period
      const range = getJournalDateRange(journal);
      if (range.start && range.end) {
        periodStart = range.start;
        periodEnd = range.end;
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
        semester: translatePeriod(uiSettings.currentTerm),
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
  <SubpageHeader title="Export Financial Report">
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => {
          return loadData();
        }}
        {isLoading}
        icon={RefreshCcw}
      />
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        onclick={() => {
          return loadData();
        }}
        {isLoading}
        icon={RefreshCcw}>Try Again</Button
      >
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
                <Label>Period Start</Label>
                <Input type="date" bind:value={periodStart} />
              </div>
              <div class="space-y-2">
                <Label>Period End</Label>
                <Input type="date" bind:value={periodEnd} />
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
              filter={(a) => {
                return a.period === uiSettings.currentTerm;
              }}
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
                <span class="mt-0.5 font-mono text-xs text-muted-foreground"
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
              filter={(a) => {
                return a.period === uiSettings.currentTerm;
              }}
              onSelect={(a) => {
                assessedBy = a.name;
                assessedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-xs font-bold text-foreground/80"
                  >{assessedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-xs text-muted-foreground"
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
              filter={(a) => {
                return a.period === uiSettings.currentTerm;
              }}
              onSelect={(a) => {
                certifiedBy = a.name;
                certifiedByEmail = a.email;
              }}
            />
            <div
              class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
            >
              <div class="flex flex-col">
                <span class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                  >Current Selection</span
                >
                <span class="text-xs font-bold text-foreground/80"
                  >{certifiedBy || "None selected"}</span
                >
                <span class="mt-0.5 font-mono text-xs text-muted-foreground"
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
        isLoading={isProcessing}
        disabled={journal.length === 0}
        icon={HandCoins}
      >
        Generate Financial Report
      </Button>
    </div>
  {/if}
</div>
