<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { brandingState } from "$state/branding.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchJournalEntries } from "$api/controllers/journal-controller";
  import { fetchTransactionTypes } from "$api/controllers/constants-controller";
  import { changeAccountType as changeAccountTypeController } from "$api/controllers/resident-controller";
  import { translateCollege, translateProgram } from "$utils/translators";
  import { parseDateWeight } from "$utils/parsers";
  import { pluralize } from "$utils/formatters";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Label } from "$ui/label";
  import TermFilter from "$components/TermFilter.svelte";
  import {
    RefreshCcw,
    ShieldCheck,
    Info,
    ArrowUpRight,
    Mail,
    ChevronDown,
    FileCheck
  } from "@lucide/svelte";
  import {
    JOURNAL_COL as JOR,
    ACCOUNT_COL,
    type ResidentRecord,
    type JournalRecord,
    AccountType,
    ACCOUNT_TYPE_LABELS
  } from "$lib/types";
  import * as AlertDialog from "$ui/alert-dialog";
  import {
    stageStatusEmail,
    stageClearanceEmail,
    fetchResidents
  } from "$api/controllers/resident-controller";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import FinancialStandingCard from "$components/residents/FinancialStandingCard.svelte";
  import StudentProfileCard from "$components/residents/StudentProfileCard.svelte";
  import ClearanceCard from "$components/residents/ClearanceCard.svelte";
  import ClearanceDialog from "$components/residents/ClearanceDialog.svelte";
  import TransactionHistoryCard from "$components/residents/TransactionHistoryCard.svelte";

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

  async function loadResidentProfile(bypassCache = false) {
    isLoading = true;
    error = null;

    try {
      const allResidents = await fetchResidents(bypassCache);
      const allRowsForStno = allResidents.filter((r) => r.stno === stno);

      if (allRowsForStno.length === 0) {
        error = `Resident with ID ${stno} not found in the database.`;
        showAlert("Search Error", error, "error");
        return;
      }

      semesterCount = allRowsForStno.length;

      const currTerm = await uiSettings.ensureCurrentTerm();
      if (!localTerm) {
        localTerm = currTerm;
      }
      const matchedResident = allRowsForStno.find((r) => !localTerm || r.period === localTerm);

      if (!matchedResident) {
        error = `This person is not a resident for the selected term (${currTerm || "All Term"}).`;
        showAlert("Term Error", error, "error");
        return;
      }

      account = matchedResident;

      // 2. Fetch Transaction History & Types
      const [entries, types] = await Promise.all([
        fetchJournalEntries(undefined, undefined),
        fetchTransactionTypes(bypassCache)
      ]);

      const journalList = Array.isArray(entries) ? entries : entries.items;

      history = journalList
        .filter(
          (r) =>
            r.account.trim().toLowerCase() === account?.email.toLowerCase() &&
            r.stno.trim() === stno &&
            (!localTerm || r.period === localTerm)
        )
        .map((journal) => ({
          ...journal,
          dateWeight: parseDateWeight(journal.date)
        }))
        .sort((a, b) => b.dateWeight - a.dateWeight || (b.ledgerIndex ?? 0) - (a.ledgerIndex ?? 0));

      transactionTypes = types;
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
  let isChangingType = $state(false);

  const ACCOUNT_TYPE_OPTIONS = [
    { value: AccountType.STUDENT, label: ACCOUNT_TYPE_LABELS.STUDENT },
    { value: AccountType.TRANSIENT, label: ACCOUNT_TYPE_LABELS.TRANSIENT },
    { value: AccountType.BOOTCAMP, label: ACCOUNT_TYPE_LABELS.BOOTCAMP },
    { value: AccountType.ALUMNUS, label: ACCOUNT_TYPE_LABELS.ALUMNUS },
    { value: AccountType.FACULTY, label: ACCOUNT_TYPE_LABELS.FACULTY },
    { value: AccountType.STAFF, label: ACCOUNT_TYPE_LABELS.STAFF },
    { value: AccountType.REPS, label: ACCOUNT_TYPE_LABELS.REPS }
  ];

  async function changeAccountType(newType: string) {
    if (!account) {
      return;
    }
    isChangingType = true;
    try {
      await changeAccountTypeController(account.residentId, account.period, newType);
      showAlert("Account Type Updated", `Account type changed to ${newType}.`);
      await loadResidentProfile(true);
    } catch (e: any) {
      showAlert("Update Failed", e.message, "error");
    } finally {
      isChangingType = false;
    }
  }

  onMount(async () => {
    allAccounts = await fetchResidents();
  });

  async function handleClear() {
    if (!account) {
      return;
    }
    residentsToClear = [account];
    isClearDialogOpen = true;
  }
</script>

<div class="space-y-3">
  <SubpageHeader
    title={account?.name || "Resident Profile"}
    onRefresh={() => loadResidentProfile(true)}
    isRefreshing={isLoading}
  >
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
      {#if account}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button size="sm" {...props} icon={Mail}>
                Send
                <ChevronDown class="ml-1.5 h-3 w-3 opacity-50" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-56">
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
      {/if}
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-4" href="/admin/residents">Return to Directory</Button>
    </ErrorView>
  {:else if account}
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="lg:col-span-3">
        <TermFilter bind:value={localTerm} onSelect={loadResidentProfile} />
      </div>

      {#if (!account.ceIssued || account.ceIssued === "" || account.ceIssued === "#N/A") && account.bal <= 0 && account.totalBase > 0}
        <div class="flex items-center lg:col-span-9">
          <Button variant="outline" size="sm" onclick={handleClear} icon={ShieldCheck}>
            Mark as Cleared
          </Button>
        </div>
      {/if}
    </div>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Student Profile -->
      <StudentProfileCard
        {account}
        {semesterCount}
        {isChangingType}
        onChangeAccountType={changeAccountType}
      />

      <!-- Financial & Clearance Info -->
      <div class="flex h-full flex-col gap-6">
        <FinancialStandingCard {account}>
          {#snippet actions()}
            <Button
              variant="secondary"
              size="sm"
              class="w-full"
              href="/admin/transactions/add?account={account.stno}"
              icon={ArrowUpRight}
            >
              Add Transaction
            </Button>
          {/snippet}
        </FinancialStandingCard>

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
