<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import {
    formatCurrency,
    formatAmount,
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
    User,
    ShieldCheck,
    CreditCard,
    History,
    Info,
    ArrowUpRight,
    MapPin,
    GraduationCap,
    Clock,
    Mail,
    Send,
    IdCard,
    Bed as BedIcon,
    Droplets,
    Users,
    Wallet,
    Calendar,
    Hash,
    ClipboardCheck,
    AwardIcon
  } from "lucide-svelte";
  import {
    ACCOUNT_COL as ACC,
    JOURNAL_COL as JOR,
    type ResidentRecord as AccountRecord,
    type JournalRecord
  } from "$lib/schemas";
  import { stageStatusEmail, mapRowToResident, mapRowToJournal } from "$lib/resident-logic";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";

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
  <SubpageHeader title={account?.name || "Resident Profile"}>
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
          <span class="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading profile..." />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-4" href="/admin/residents">Return to Hub</Button>
    </ErrorView>
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
            href="/admin/transactions/add?account={account.email}"
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
            <Mail class="mr-1.5 h-3.5 w-3.5" /> Send Payment Status
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
      <!-- Student Profile -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <User class="h-5 w-5" />
            Student Profile
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1 space-y-4">
          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
              ><Mail class="h-3 w-3" /> Email Address</Label
            >
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-foreground">{account.email}</p>
              <a
                href="mailto:{account.email}"
                class="text-muted-foreground transition-colors hover:text-primary"
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
              class="relative mt-2 space-y-6 before:absolute before:top-2 before:left-[11px] before:h-[calc(100%-16px)] before:w-px before:bg-border"
            >
              {#each qualifications as q}
                <div class="relative flex items-start gap-4 pl-8">
                  <div
                    class="absolute left-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-background bg-muted shadow-sm ring-1 ring-border"
                  >
                    <AwardIcon class="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span
                      class="text-[9px] font-bold tracking-widest text-primary uppercase opacity-80"
                      >{q.college}</span
                    >
                    <p class="text-[13px] leading-tight font-bold text-foreground">
                      {q.program}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
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

      <!-- Financial & Clearance Info -->
      <div class="flex h-full flex-col gap-6">
        <Card.Root class="flex h-full flex-col">
          <Card.Header>
            <Card.Title class="flex items-center gap-2 text-lg">
              <CreditCard class="h-5 w-5" />
              Financial Standing
            </Card.Title>
          </Card.Header>
          <Card.Content class="flex-1 space-y-6">
            <!-- Water Fee Section -->
            <div class="space-y-3">
              <div class="pb-1">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                >
                  <Droplets class="h-3 w-3" /> Water Fee
                </Label>
              </div>
              <div
                class="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-muted-foreground uppercase"
              >
                <div class="flex flex-col gap-0.5">
                  <span>Base</span>
                  <span class="text-foreground">{formatAmount(account.waterBase)}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span>Paid</span>
                  <span class="text-foreground text-primary">{formatAmount(account.waterPaid)}</span
                  >
                </div>
                <div class="flex flex-col gap-0.5">
                  <span>Waived</span>
                  <span class="text-foreground">{formatAmount(account.waterWaived)}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span>Balance</span>
                  <span class="text-foreground {account.waterBal < 0 ? 'text-primary' : ''}"
                    >{formatAmount(account.waterBal)}</span
                  >
                </div>
              </div>
            </div>

            <!-- Association Fee Section -->
            <div class="space-y-3">
              <div class="pb-1">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                >
                  <Users class="h-3 w-3" /> Association Fee
                </Label>
              </div>
              <div
                class="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-muted-foreground uppercase"
              >
                <div class="flex flex-col gap-0.5">
                  <span>Base</span>
                  <span class="text-foreground">{formatAmount(account.assocBase)}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span>Paid</span>
                  <span class="text-foreground text-primary">{formatAmount(account.assocPaid)}</span
                  >
                </div>
                <div class="flex flex-col gap-0.5">
                  <span>Waived</span>
                  <span class="text-foreground">{formatAmount(account.assocWaived)}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span>Balance</span>
                  <span class="text-foreground {account.assocBal < 0 ? 'text-primary' : ''}"
                    >{formatAmount(account.assocBal)}</span
                  >
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1 pt-2">
              <Label
                class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
              >
                <Wallet class="h-3 w-3" /> Total Amount Due
              </Label>
              <div class="text-left">
                <p
                  class="text-xl font-bold tabular-nums {account.bal < 0
                    ? 'text-primary'
                    : 'text-foreground'}"
                >
                  {formatCurrency(account.bal)}
                </p>
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        {#if account.raw[ACC.NOTES]?.trim()}
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
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title
            class="flex items-center gap-2 text-lg {account.ceIssued ? 'text-primary' : ''}"
          >
            <ShieldCheck class="h-5 w-5" />
            Clearance
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1 space-y-4">
          {#if account.ceIssued}
            <div class="space-y-3">
              <div class="flex flex-col gap-1">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                >
                  <ClipboardCheck class="h-3 w-3" /> Verification Status
                </Label>
                <Badge
                  class="w-fit border-transparent bg-primary px-3 py-1 text-[10px] font-black text-primary-foreground"
                  >VERIFIED</Badge
                >
              </div>
              <div class="flex flex-col gap-1 pt-2">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                >
                  <Calendar class="h-3 w-3" /> Issued Date
                </Label>
                <span class="text-sm font-bold text-foreground">{account.ceIssued}</span>
              </div>
              <div class="flex flex-col gap-1 pt-2">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                >
                  <Hash class="h-3 w-3" /> Reference Number
                </Label>
                <span class="font-mono text-sm font-black text-foreground"
                  >{account.ceRefNo || "—"}</span
                >
              </div>
            </div>
          {:else}
            <div class="space-y-4">
              <div class="flex flex-col gap-1">
                <Label
                  class="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                >
                  <ClipboardCheck class="h-3 w-3" /> Verification Status
                </Label>
                <Badge
                  class="w-fit border-transparent bg-destructive px-3 py-1 text-[10px] font-black text-white"
                  >NOT CLEARED</Badge
                >
              </div>
            </div>
          {/if}
        </Card.Content>
        {#if account.ceIssued && account.ceLink}
          <Card.Footer>
            <Button
              variant="outline"
              size="sm"
              class="h-10 w-full border-primary/20 text-xs font-bold text-primary transition-all hover:bg-primary/5"
              href={account.ceLink}
              target="_blank"
            >
              View Certificate <ArrowUpRight class="ml-2 h-4 w-4" />
            </Button>
          </Card.Footer>
        {/if}
      </Card.Root>
    </div>

    <!-- Transaction History -->
    <Card.Root class="overflow-hidden">
      <Card.Header class="flex flex-row items-center justify-between bg-muted/5">
        <Card.Title class="flex items-center gap-2 text-lg">
          <History class="h-5 w-5" />
          Transaction History
        </Card.Title>
        <Badge variant="outline" class="font-bold"
          >{pluralize(history.length, "entry", "entries")}</Badge
        >
      </Card.Header>
      <Card.Content>
        {#if history.length > 0}
          <DataTable
            data={history}
            {columns}
            meta={{ transactionTypes }}
            onRowClick={(r) => goto(`/admin/transactions/${r.id}`)}
            rowId="id"
          />
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
  {/if}
</div>

<style>
  :global(.prose) {
    color: inherit;
  }
</style>
