<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import {
    formatCurrency,
    formatAmount,
    formatDate,
    translateMop,
    translateCollege,
    translateProgram,
    parseDateWeight,
    translateType
  } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    LoaderCircle,
    RefreshCcw,
    ChevronLeft,
    User,
    ShieldCheck,
    CreditCard,
    History,
    CircleAlert,
    Info,
    ArrowUpRight,
    MapPin,
    GraduationCap,
    Clock,
    Mail,
    Send,
    IdCard,
    Bed as BedIcon,
    ArrowRight
  } from "lucide-svelte";
  import {
    ACCOUNT_COL as ACC,
    JOURNAL_COL as JOR,
    type ResidentRecord as AccountRecord,
    type JournalRecord
  } from "$lib/schemas";
  import {
    stageStatusEmail,
    parseAmount,
    mapRowToResident,
    mapRowToJournal
  } from "$lib/resident-logic";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  const stno = $derived(page.params.stno);

  let account = $state<AccountRecord | null>(null);
  let history = $state<JournalRecord[]>([]);
  let semesterCount = $state(0);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

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

  async function loadResidentProfile(forceRefresh = false) {
    if (!brandingState.spreadsheetId || !stno) return;
    isLoading = true;
    error = null;

    try {
      // 1. Fetch Account Details
      const accRows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "accounts!A:AD",
        forceRefresh
      );
      const allRowsForStno = accRows.filter((r) => r[ACC.STNO]?.trim() === stno);

      if (allRowsForStno.length === 0) {
        error = `Resident with ID ${stno} not found in the database.`;
        return;
      }

      semesterCount = allRowsForStno.length;

      const matchedRow = allRowsForStno.find(
        (r) => !uiSettings.currentSemester || r[ACC.PERIOD] === uiSettings.currentSemester
      );

      if (!matchedRow) {
        error = `This person is not a resident for the selected semester (${uiSettings.currentSemester || "All Term"}).`;
        return;
      }

      account = mapRowToResident(matchedRow);

      // 2. Fetch Transaction History
      const jorRows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "journal_general!A:W",
        forceRefresh
      );
      history = jorRows
        .slice(1)
        .filter(
          (r) =>
            r[JOR.ACCOUNT]?.trim().toLowerCase() === account?.email.toLowerCase() &&
            r[JOR.STNO]?.trim() === stno &&
            (!uiSettings.currentSemester || r[JOR.PERIOD] === uiSettings.currentSemester)
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
        brandingState.spreadsheetId,
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
    } finally {
      isLoading = false;
    }
  }

  onMount(loadResidentProfile);

  function sendStatusEmail() {
    if (!account) return;
    stageStatusEmail(account, brandingState.profile, {
      clearQueue: true,
      redirect: true
    });
  }
</script>

<div class="space-y-6">
  <SubpageHeader title={account?.name || "Resident Profile"} href="/legacy/admin/residents">
    {#snippet titleExtra()}
      {#if account}
        <div class="flex flex-wrap gap-2">
          {#if account.bal < 0}
            <Badge
              variant="outline"
              class="border-primary/20 bg-primary/5 text-[10px] font-black tracking-tighter text-primary uppercase"
              >Overpaid</Badge
            >
          {/if}
          {#if account.bal === 0 && (account.waterBal < 0 || account.assocBal < 0)}
            <Badge
              variant="outline"
              class="border-amber-200 bg-amber-100 text-[10px] font-black tracking-tighter text-amber-700 uppercase"
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
          disabled={isLoading}
        >
          <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
          <span class="hidden sm:inline">Refresh Data</span>
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading profile..." />
  {:else if error}
    <Card.Root class="border-destructive/20 bg-destructive/5">
      <Card.Content class="flex flex-col items-center justify-center p-12 text-center">
        <CircleAlert class="mb-4 h-12 w-12 text-destructive opacity-50" />
        <h2 class="text-lg font-bold text-destructive">{error}</h2>
        <Button variant="outline" class="mt-4" href="/legacy/admin/residents">Return to Hub</Button>
      </Card.Content>
    </Card.Root>
  {:else if account}
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="lg:col-span-3">
        <TermFilter onSelect={loadResidentProfile} />
      </div>

      <div class="space-y-1 lg:col-span-9">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Actions</Label>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            href="/legacy/admin/transactions/add?account={account.email}"
            class="h-9 border-primary/20 text-xs font-bold text-primary hover:bg-primary/5"
          >
            <ArrowUpRight class="mr-1.5 h-3.5 w-3.5" /> Add Transaction
          </Button>
          <Button
            variant="outline"
            size="sm"
            onclick={sendStatusEmail}
            class="h-9 border-primary/20 text-xs font-bold text-primary hover:bg-primary/5"
          >
            <Mail class="mr-1.5 h-3.5 w-3.5" /> Send Status Update
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="pointer-events-none h-9 text-xs font-bold opacity-50"
          >
            Export Statement (PDF)
          </Button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Sidebar Information -->
      <div class="order-2 space-y-6 lg:order-1 lg:col-span-1">
        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <User class="h-5 w-5" />
              Student Profile
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-1">
              <Label
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                ><Mail class="h-3 w-3" /> Email Address</Label
              >
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-slate-900">{account.email}</p>
                <a
                  href="mailto:{account.email}"
                  class="text-slate-400 transition-colors hover:text-primary"
                  title="Send Email"
                >
                  <Send class="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <div class="space-y-1">
              <Label
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                ><IdCard class="h-3 w-3" /> Student Number</Label
              >
              <p class="text-sm font-semibold">{account.stno}</p>
            </div>

            <div class="space-y-1">
              <Label
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                ><Clock class="h-3 w-3" /> Semesters Active</Label
              >
              <div class="text-sm font-semibold">
                {semesterCount}
                {semesterCount === 1 ? "Semester" : "Semesters"}
              </div>
            </div>

            <div class="space-y-4">
              <Label
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
              >
                <GraduationCap class="h-3 w-3" /> Academic Program
              </Label>
              <div
                class="relative mt-2 space-y-6 before:absolute before:top-2 before:left-[11px] before:h-[calc(100%-16px)] before:w-px before:bg-slate-200"
              >
                {#each qualifications as q}
                  <div class="relative flex items-start gap-4 pl-8">
                    <div
                      class="absolute left-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-slate-50 shadow-sm ring-1 ring-slate-200"
                    >
                      <GraduationCap class="h-2.5 w-2.5 text-slate-400" />
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <span
                        class="text-[9px] font-black tracking-widest text-primary uppercase opacity-80"
                        >{q.college}</span
                      >
                      <p class="text-[13px] leading-tight font-bold text-slate-900">
                        {q.program}
                      </p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div class="space-y-1">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                  ><MapPin class="h-3 w-3" /> Room</Label
                >
                <div class="text-sm font-semibold">{account.room}</div>
              </div>
              <div class="space-y-1">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                  ><BedIcon class="h-3 w-3" /> Bed</Label
                >
                <p class="text-sm font-semibold">{account.bed}</p>
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        {#if account.ceIssued}
          <Card.Root>
            <Card.Header>
              <Card.Title class="flex items-center gap-2 text-lg text-primary">
                <ShieldCheck class="h-5 w-5" />
                Clearance Status
              </Card.Title>
            </Card.Header>
            <Card.Content class="space-y-4">
              <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span class="text-xs font-medium text-slate-600">Verification</span>
                <Badge
                  variant="outline"
                  class="w-fit border-transparent bg-primary px-2 py-0.5 text-[10px] font-black text-white"
                  >VERIFIED</Badge
                >
              </div>
              <div class="space-y-3">
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-medium text-slate-600">Issued Date</span>
                  <span class="text-sm font-bold text-slate-900">{account.ceIssued}</span>
                </div>
                <div class="flex flex-col gap-1 border-t border-slate-100 pt-3">
                  <span class="text-xs font-medium tracking-tight text-slate-600">Ref No.</span>
                  <span class="font-mono text-sm font-black text-slate-900"
                    >{account.ceRefNo || "—"}</span
                  >
                </div>
              </div>
              {#if account.ceLink}
                <Button
                  variant="outline"
                  size="sm"
                  class="h-9 w-full border-primary/20 text-xs font-bold text-primary hover:bg-primary/5"
                  href={account.ceLink}
                  target="_blank"
                >
                  View Certificate <ArrowUpRight class="ml-1.5 h-4 w-4" />
                </Button>
              {/if}
            </Card.Content>
          </Card.Root>
        {/if}

        <Card.Root>
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <CreditCard class="h-5 w-5" />
              Financial Standing
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="flex flex-col gap-1 border-b border-primary/10 pb-2">
              <span class="text-xs font-medium text-slate-600">Water Fee Balance</span>
              <span
                class="font-mono text-sm font-bold {account.waterBal < 0
                  ? 'text-primary'
                  : 'text-slate-900'}">{formatAmount(account.waterBal)}</span
              >
            </div>
            <div class="flex flex-col gap-1 border-b border-primary/10 pb-2">
              <span class="text-xs font-medium text-slate-600">Association Fee Balance</span>
              <span
                class="font-mono text-sm font-bold {account.assocBal < 0
                  ? 'text-primary'
                  : 'text-slate-900'}">{formatAmount(account.assocBal)}</span
              >
            </div>
            <div class="flex flex-col gap-1 pt-2">
              <span class="text-xs font-black text-slate-900 uppercase">Total Outstanding</span>
              <div class="text-left">
                <p
                  class="text-xl font-black tabular-nums {account.bal < 0
                    ? 'text-primary'
                    : 'text-slate-900'}"
                >
                  {formatCurrency(account.bal)}
                </p>
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        {#if account.raw[ACC.NOTES]}
          <Card.Root class="border-amber-200 bg-amber-50/30">
            <Card.Header>
              <Card.Title class="flex items-center gap-2 text-sm text-amber-900">
                <Info class="h-4 w-4" /> Account Notes
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <p class="text-xs leading-relaxed font-medium text-amber-800">
                {@html account.raw[ACC.NOTES]}
              </p>
            </Card.Content>
          </Card.Root>
        {/if}
      </div>

      <!-- Main Activity History -->
      <div class="order-1 space-y-6 lg:order-2 lg:col-span-2">
        <Card.Root class="overflow-hidden">
          <Card.Header class="flex flex-row items-center justify-between bg-muted/5">
            <Card.Title class="flex items-center gap-2 text-lg">
              <History class="h-5 w-5" />
              Transaction History
            </Card.Title>
            <Badge variant="outline" class="font-bold">{history.length} entries</Badge>
          </Card.Header>
          <Card.Content class="p-0">
            {#if history.length > 0}
              <div class="w-full overflow-x-auto">
                <Table.Root>
                  <Table.Header>
                    <Table.Row class="bg-muted/10">
                      <Table.Head class="px-4 py-3 text-[10px] font-bold uppercase">Date</Table.Head
                      >
                      <Table.Head class="px-4 py-3 text-[10px] font-bold uppercase"
                        >Type/MOP</Table.Head
                      >
                      <Table.Head class="px-4 py-3 text-[10px] font-bold uppercase"
                        >Notes</Table.Head
                      >
                      <Table.Head class="px-4 py-3 text-right text-[10px] font-bold uppercase"
                        >Amount</Table.Head
                      >
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each history as entry}
                      <Table.Row class="transition-colors hover:bg-muted/5">
                        <Table.Cell class="px-4 py-3 align-top whitespace-nowrap">
                          <div class="flex flex-col">
                            <a
                              href="/legacy/admin/transactions/{entry.id}"
                              class="text-[11px] font-bold text-slate-900 hover:text-primary hover:underline"
                              >{formatDate(entry.date)}</a
                            >
                            <span class="text-[9px] font-medium text-muted-foreground"
                              >{entry.creator}</span
                            >
                          </div>
                        </Table.Cell>
                        <Table.Cell class="px-4 py-3 align-top">
                          <div class="flex flex-col">
                            <span
                              class="text-[10px] font-black tracking-tight text-slate-800 uppercase"
                              >{translateType(entry.type, transactionTypes)}</span
                            >
                            <span class="text-[9px] text-muted-foreground"
                              >{translateMop(entry.mop)}</span
                            >
                          </div>
                        </Table.Cell>
                        <Table.Cell class="px-4 py-3 align-top">
                          <p class="text-[10px] leading-tight whitespace-pre-wrap text-slate-600">
                            {entry.notes || "—"}
                          </p>
                        </Table.Cell>
                        <Table.Cell class="px-4 py-3 text-right align-top">
                          <span class="font-mono text-xs font-bold text-slate-900 tabular-nums">
                            {formatCurrency(entry.amount)}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    {/each}
                  </Table.Body>
                </Table.Root>
              </div>
            {:else}
              <div class="flex h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <Clock class="h-8 w-8 text-muted-foreground opacity-20" />
                <p class="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                  No transaction history found
                </p>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.prose) {
    color: inherit;
  }
</style>
