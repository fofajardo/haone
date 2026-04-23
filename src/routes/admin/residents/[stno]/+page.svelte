<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import {
    translateCollege,
    translateProgram,
    parseDateWeight,
    pluralize
  } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    ShieldCheck,
    Info,
    ArrowUpRight,
    Mail,
    ChevronDown,
    FileCheck,
    FileDown,
    UserCog
  } from "lucide-svelte";
  import { JOURNAL_COL as JOR, type ResidentRecord, type JournalRecord } from "$lib/schemas";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import {
    stageStatusEmail,
    stageClearanceEmail,
    fetchResidents,
    mapRowToJournal
  } from "$lib/resident-logic";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import FinancialStandingCard from "$lib/components/residents/FinancialStandingCard.svelte";
  import StudentProfileCard from "$lib/components/residents/StudentProfileCard.svelte";
  import ClearanceCard from "$lib/components/residents/ClearanceCard.svelte";
  import ClearanceDialog from "$lib/components/residents/ClearanceDialog.svelte";
  import TransactionHistoryCard from "$lib/components/residents/TransactionHistoryCard.svelte";

  const stno = $derived(page.params.stno);

  let account = $state<ResidentRecord | null>(null);
  let history = $state<JournalRecord[]>([]);
  let semesterCount = $state(0);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let localTerm = $state(page.url.searchParams.get("term") || uiSettings.currentTerm);

  const qualifications = $derived(
    account
      ? translateCollege(account.college).map((col, i) => {
          const programs = translateProgram(account!.program);
          return {
            college: col,
            program: programs[i] || "—"
          };
        })
      : []
  );

  let alertDialog = $state({
    open: false,
    title: "",
    description: "",
    type: "info" as "info" | "error"
  });

  function showAlert(title: string, description: string, type: "info" | "error" = "info") {
    alertDialog = { open: true, title, description, type };
  }

  async function loadResidentProfile(forceRefresh = false) {
    if (!uiSettings.accountingWorkbookId || !stno) return;
    isLoading = true;
    error = null;

    try {
      const allResidents = await fetchResidents(forceRefresh);
      const allRowsForStno = allResidents.filter((r) => r.stno === stno);

      if (allRowsForStno.length === 0) {
        error = `Resident with ID ${stno} not found in the database.`;
        showAlert("Search Error", error, "error");
        return;
      }

      semesterCount = allRowsForStno.length;

      const matchedResident = allRowsForStno.find((r) => !localTerm || r.period === localTerm);

      if (!matchedResident) {
        error = `This person is not a resident for the selected semester (${uiSettings.currentTerm || "All Term"}).`;
        showAlert("Semester Error", error, "error");
        return;
      }

      account = matchedResident;

      // 2. Fetch Transaction History
      const jorRows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:T",
        forceRefresh
      );
      history = jorRows
        .slice(1)
        .filter(
          (r) =>
            r[JOR.ACCOUNT]?.trim().toLowerCase() === account?.email.toLowerCase() &&
            r[JOR.STNO]?.trim() === stno &&
            (!localTerm || r[JOR.PERIOD] === localTerm)
        )
        .map((r, idx) => {
          const journal = mapRowToJournal(r, idx);
          return {
            ...journal,
            dateWeight: parseDateWeight(journal.date)
          };
        })
        .sort((a, b) => b.dateWeight - a.dateWeight || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0));

      // 3. Fetch Transaction Types
      const constRows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "constants!A:C",
        forceRefresh
      );
      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));
    } catch (e: any) {
      error = e.message;
      showAlert("Data Error", e.message, "error");
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    // Initial load will use the localTerm which already took the query param into account
    await loadResidentProfile();
  });

  function sendStatusEmail() {
    if (!account) return;
    stageStatusEmail(account, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }

  function sendClearanceEmail() {
    if (!account) return;
    if (!account.ceLink) {
      showAlert(
        "Dispatch Blocked",
        "No clearance certificate generated for this resident yet.",
        "error"
      );
      return;
    }
    stageClearanceEmail(account, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }

  let isClearDialogOpen = $state(false);
  let residentsToClear = $state<ResidentRecord[]>([]);
  let allAccounts = $state<ResidentRecord[]>([]);

  onMount(async () => {
    if (uiSettings.accountingWorkbookId) {
      allAccounts = await fetchResidents();
    }
  });

  async function handleClear() {
    if (!account) return;
    residentsToClear = [account];
    isClearDialogOpen = true;
  }
</script>

<div class="space-y-6">
  <SubpageHeader title={account?.name || "Resident Profile"}>
    {#snippet titleExtra()}
      {#if account}
        <div class="flex flex-wrap gap-2">
          {#if account.bal < 0}
            <Badge
              variant="outline"
              class="border-primary/20 bg-primary/5 text-xs font-black tracking-tighter text-primary uppercase"
              >Overpaid</Badge
            >
          {/if}
          {#if account.bal === 0 && (account.waterBal < 0 || account.assocBal < 0)}
            <Badge
              variant="outline"
              class="border-amber-200 bg-amber-100 text-xs font-black tracking-tighter text-amber-700 uppercase"
              >Potential Misassignment</Badge
            >
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadResidentProfile(true)}
          {isLoading}
          icon={RefreshCcw}
        >
          <span class="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading profile…" />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-4" href="/admin/residents">Return to Directory</Button>
    </ErrorView>
  {:else if account}
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="lg:col-span-3">
        <TermFilter bind:value={localTerm} onSelect={loadResidentProfile} />
      </div>

      <div class="space-y-1 lg:col-span-9">
        <Label class="text-xs font-bold text-muted-foreground uppercase">Actions</Label>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            href="/admin/transactions/add?account={account.email}"
            icon={ArrowUpRight}
          >
            Add Transaction
          </Button>

          {#if (!account.ceIssued || account.ceIssued === "" || account.ceIssued === "#N/A") && account.bal <= 0 && account.totalBase > 0}
            <Button variant="outline" size="sm" onclick={handleClear} icon={ShieldCheck}>
              Mark as Cleared
            </Button>
          {/if}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button variant="outline" size="sm" {...props} icon={Mail}>
                  Send
                  <ChevronDown class="ml-1.5 h-3 w-3 opacity-50" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-56">
              <DropdownMenu.Item onclick={sendStatusEmail}>
                <Mail class="mr-2 h-4 w-4" />
                <span>Send Payment Status</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={sendClearanceEmail}
                disabled={!account.ceLink || account.ceLink === "N/A" || account.ceLink === ""}
              >
                <FileCheck class="mr-2 h-4 w-4" />
                <span>Send Clearance Certificate</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <Button
            variant="outline"
            size="sm"
            href="/admin/users/{account.residentId}"
            icon={UserCog}
          >
            View User Profile
          </Button>

          <Button variant="outline" size="sm" disabled icon={FileDown}>
            Export Statement (PDF)
          </Button>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Student Profile -->
      <StudentProfileCard {account} {semesterCount} />

      <!-- Financial & Clearance Info -->
      <div class="flex h-full flex-col gap-6">
        <FinancialStandingCard {account} />

        {#if account.notes?.trim()}
          <Card.Root class="border-amber-200 bg-amber-50/30">
            <Card.Header>
              <Card.Title class="flex items-center gap-2 text-sm text-amber-900">
                <Info class="h-4 w-4" /> Account Notes
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <p class="text-xs leading-relaxed font-medium text-amber-800">
                {@html account.notes}
              </p>
            </Card.Content>
          </Card.Root>
        {/if}
      </div>
      <ClearanceCard {account} />
    </div>

    <TransactionHistoryCard
      {history}
      {transactionTypes}
      onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
    />
  {/if}
</div>

<ClearanceDialog
  bind:open={isClearDialogOpen}
  residents={residentsToClear}
  {allAccounts}
  onSuccess={(count) => {
    showAlert("Success", `${pluralize(count, "resident", "residents")} marked as cleared.`);
  }}
/>

<AlertDialog.Root open={alertDialog.open} onOpenChange={(v) => (alertDialog.open = v)}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{alertDialog.title}</AlertDialog.Title>
      <AlertDialog.Description>{alertDialog.description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertDialog.open = false)}>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<style>
  :global(.prose) {
    color: inherit;
  }
</style>
