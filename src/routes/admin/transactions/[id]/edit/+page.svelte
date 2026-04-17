<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/auth.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, updateSheetValue, updateRowInCache } from "$lib/google-sheets";
  import { translatePeriod, translateMop, parseRef } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import {
    LoaderCircle,
    ChevronLeft,
    Search,
    Calendar,
    Users,
    Wallet,
    StickyNote,
    AlertCircle
  } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  const id = $derived(page.params.id);

  import { JOURNAL_COL as JOR, ACCOUNT_COL as ACC, type JournalRecord } from "$lib/schemas";
  import { mapRowToJournal } from "$lib/resident-logic";

  interface AccountRecord {
    email: string;
    name: string;
    stNo: string;
    period: string;
    raw: string[];
  }

  let accounts = $state<AccountRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let academicPeriods = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let rowIndex = $state<number | null>(null);

  // Form State
  let formData = $state({
    date: "",
    creatorEmail: "",
    creatorName: "",
    creatorStNo: "",
    accountEmail: "",
    accountName: "",
    accountStNo: "",
    waterFee: "0",
    assocFee: "0",
    miscFee: "0",
    mop: "CASH",
    period: "",
    type: "COLLECTION",
    notes: "",
    notesPrivate: "",
    mopRefNo: "",
    instapayInvoice: "",
    prDateIssued: "",
    prRefNo: ""
  });

  // Autocomplete State
  let creatorSearch = $state("");
  let accountSearch = $state("");
  let showCreatorSuggestions = $state(false);
  let showAccountSuggestions = $state(false);

  async function loadData() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      // 1. Fetch Accounts & Constants
      const [accRows, constRows, journalRows] = await Promise.all([
        fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:AD"),
        fetchSheetRowsRaw(brandingState.spreadsheetId, "constants!A:C"),
        fetchSheetRowsRaw(brandingState.spreadsheetId, "journal_general!A:W")
      ]);

      accounts = accRows
        .slice(1)
        .map((row) => ({
          email: (row[ACC.EMAIL] || "").trim(),
          name: (row[ACC.NAME] || "").trim(),
          stNo: (row[ACC.STNO] || "").toString().trim(),
          period: (row[ACC.PERIOD] || "").trim(),
          raw: row
        }))
        .filter((a) => a.email && a.email.toLowerCase() !== "email");

      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));

      academicPeriods = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("SEM_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[1] || r[0]
        }));

      mopTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("MOP_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: translateMop(r[1] || r[0])
        }));

      // 2. Find Transaction
      const idx = journalRows.findIndex((row) => row[JOR.ID] === id);
      if (idx === -1) {
        error = "Transaction not found.";
        return;
      }
      rowIndex = idx; // 0-indexed index in row array (includes header at 0)
      const txn = mapRowToJournal(journalRows[idx]);

      if (txn.wasAudited) {
        error = "This transaction has been audited and cannot be edited.";
        return;
      }

      // 3. Populate Form
      const mopRefInfo = parseRef(txn.mopRefNo);

      formData = {
        date: txn.date,
        creatorEmail: txn.creator,
        creatorName: txn.creatorName,
        creatorStNo: "", // Resolving below
        accountEmail: txn.account,
        accountName: txn.name,
        accountStNo: txn.stno,
        waterFee: txn.water.toString(),
        assocFee: txn.assoc.toString(),
        miscFee: txn.misc.toString(),
        mop: txn.mop,
        period: txn.period,
        type: txn.type,
        notes: txn.notes,
        notesPrivate: txn.notesPrivate,
        mopRefNo: mopRefInfo.reference || txn.mopRefNo,
        instapayInvoice: mopRefInfo.invoice || "",
        prDateIssued: txn.prDateIssued,
        prRefNo: txn.prRefNo
      };

      creatorSearch = txn.creator;
      accountSearch = txn.account;

      // Resolve creator student number
      const creatorAcc = accounts.find((a) => a.email.toLowerCase() === txn.creator.toLowerCase());
      if (creatorAcc) {
        formData.creatorStNo = creatorAcc.stNo;
      }
    } catch (e: any) {
      error = `Failed to load edit data: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  const filteredCreators = $derived(
    accounts
      .filter(
        (a) =>
          a.email.toLowerCase().includes(creatorSearch.toLowerCase()) ||
          a.name.toLowerCase().includes(creatorSearch.toLowerCase())
      )
      .slice(0, 5)
  );

  const filteredAccounts = $derived(
    accounts
      .filter(
        (a) =>
          a.email.toLowerCase().includes(accountSearch.toLowerCase()) ||
          a.name.toLowerCase().includes(accountSearch.toLowerCase())
      )
      .slice(0, 5)
  );

  function selectCreator(a: AccountRecord) {
    formData.creatorEmail = a.email;
    formData.creatorName = a.name;
    formData.creatorStNo = a.stNo;
    creatorSearch = a.email;
    showCreatorSuggestions = false;
  }

  function selectAccount(a: AccountRecord) {
    formData.accountEmail = a.email;
    formData.accountName = a.name;
    formData.accountStNo = a.stNo;
    accountSearch = a.email;
    showAccountSuggestions = false;
  }

  async function handleSubmit() {
    if (rowIndex === null) return;
    isSubmitting = true;
    error = null;

    try {
      const row = new Array(23).fill("");
      row[JOR.DATE] = formData.date;
      row[JOR.CREATOR] = formData.creatorEmail;
      row[JOR.ACCOUNT] = formData.accountEmail;
      row[JOR.WATER] = formData.waterFee;
      row[JOR.ASSOC] = formData.assocFee;
      row[JOR.MISC] = formData.miscFee;
      row[JOR.MOP] = formData.mop;
      row[JOR.PERIOD] = formData.period;
      row[JOR.TYPE] = formData.type;
      row[JOR.NOTES] = formData.notes;
      row[JOR.NOTES_PRIVATE] = formData.notesPrivate;
      row[JOR.MOP_REFNO] = formData.instapayInvoice
        ? `${formData.mopRefNo};${formData.instapayInvoice}`
        : formData.mopRefNo;
      row[JOR.PR_DATE_ISSUED] = formData.prDateIssued;
      row[JOR.PR_REFNO] = formData.prRefNo;
      row[JOR.CREATOR_NAME] = formData.creatorName;
      row[JOR.NAME] = formData.accountName;
      row[JOR.STNO] = formData.accountStNo;

      // Handle Incoming/Outgoing (Optional logic from add page)
      const water = parseFloat(formData.waterFee) || 0;
      const assoc = parseFloat(formData.assocFee) || 0;
      const misc = parseFloat(formData.miscFee) || 0;
      const total = water + assoc + misc;

      if (formData.type === "COLLECTION" || formData.type === "COLLECTION_OTHERS") {
        row[JOR.INCOMING] = total.toString();
        row[JOR.OUTGOING] = "";
      } else if (formData.type === "REFUND" || formData.type === "WAIVED") {
        row[JOR.OUTGOING] = total.toString();
        row[JOR.INCOMING] = "";
      }

      row[JOR.WAS_AUDITED] = "FALSE";
      row[JOR.ID] = id; // Preserve ID

      // Range is 1-indexed. rowIndex 0 is header. data starts at rowIndex 1 -> Row 2.
      const sheetRow = rowIndex + 1;
      const range = `journal_general!A${sheetRow}:W${sheetRow}`;

      await updateSheetValue(brandingState.spreadsheetId, range, [row]);
      updateRowInCache(brandingState.spreadsheetId, "journal_general!A:W", rowIndex, row);
      goto(`/admin/transactions/${id}`);
    } catch (e: any) {
      error = `Save failed: ${e.message}`;
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="Edit Transaction" href="/admin/transactions/{id}" />

  <div class="mx-auto max-w-3xl space-y-6">
    {#if error}
      <div
        class="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 font-medium text-foreground"
      >
        <AlertCircle class="mt-0.5 h-4 w-4 text-muted-foreground" />
        <span class="text-sm">{error}</span>
      </div>
    {/if}

    {#if isLoading}
      <LoadingView text="Loading transaction details..." />
    {:else if !error}
      <Card.Root>
        <Card.Content class="space-y-8">
          <!-- Basic Details -->
          <div class="space-y-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Calendar class="h-3.5 w-3.5" /> General Information
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Transaction Date</Label
                >
                <Input type="date" bind:value={formData.date} />
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Academic Term</Label
                >
                <NativeSelect.Root
                  bind:value={formData.period}
                  class="h-10 w-full text-xs font-semibold"
                >
                  {#each academicPeriods as term}
                    <NativeSelect.Option value={term.value}
                      >{translatePeriod(term.value)}</NativeSelect.Option
                    >
                  {/each}
                </NativeSelect.Root>
              </div>
            </div>
          </div>

          <!-- Parties -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Users class="h-3.5 w-3.5" /> Transaction Parties
            </Label>
            <div class="grid gap-8 md:grid-cols-2">
              <div class="relative space-y-3">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Entry Creator</Label
                >
                <div class="relative">
                  <Search
                    class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    bind:value={creatorSearch}
                    onfocus={() => (showCreatorSuggestions = true)}
                    onblur={() => setTimeout(() => (showCreatorSuggestions = false), 200)}
                    placeholder="Search creator..."
                    class="pl-10"
                  />
                </div>
                {#if showCreatorSuggestions && creatorSearch && filteredCreators.length > 0}
                  <div
                    class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-xl"
                  >
                    {#each filteredCreators as a}
                      <button
                        onclick={() => selectCreator(a)}
                        class="flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span class="font-bold text-foreground">{a.name}</span>
                        <span class="text-[10px] text-muted-foreground">{a.email}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="relative space-y-3">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Target Account</Label
                >
                <div class="relative">
                  <Search
                    class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    bind:value={accountSearch}
                    onfocus={() => (showAccountSuggestions = true)}
                    onblur={() => setTimeout(() => (showAccountSuggestions = false), 200)}
                    placeholder="Search target account..."
                    class="pl-10"
                  />
                </div>
                {#if showAccountSuggestions && accountSearch && filteredAccounts.length > 0}
                  <div
                    class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-xl"
                  >
                    {#each filteredAccounts as a}
                      <button
                        onclick={() => selectAccount(a)}
                        class="flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span class="font-bold text-foreground">{a.name}</span>
                        <span class="text-[10px] text-muted-foreground">{a.email}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- Fees -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Wallet class="h-3.5 w-3.5" /> Payment Details
            </Label>
            <div class="grid gap-6 md:grid-cols-3">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Water Fee</Label
                >
                <Input
                  type="number"
                  step="0.01"
                  bind:value={formData.waterFee}
                  class="text-right font-mono"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Assoc Fee</Label
                >
                <Input
                  type="number"
                  step="0.01"
                  bind:value={formData.assocFee}
                  class="text-right font-mono"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Misc Fee</Label
                >
                <Input
                  type="number"
                  step="0.01"
                  bind:value={formData.miscFee}
                  class="text-right font-mono"
                />
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >MOP</Label
                >
                <NativeSelect.Root
                  bind:value={formData.mop}
                  class="h-10 w-full text-xs font-semibold"
                >
                  {#each mopTypes as mop}
                    <NativeSelect.Option value={mop.value}>{mop.label}</NativeSelect.Option>
                  {/each}
                </NativeSelect.Root>
              </div>
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Type</Label
                >
                <NativeSelect.Root
                  bind:value={formData.type}
                  class="h-10 w-full text-xs font-semibold"
                >
                  {#each transactionTypes as type}
                    <NativeSelect.Option value={type.value}>{type.label}</NativeSelect.Option>
                  {/each}
                </NativeSelect.Root>
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Reference Number</Label
                >
                <Input bind:value={formData.mopRefNo} />
              </div>
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >InstaPay Invoice</Label
                >
                <Input bind:value={formData.instapayInvoice} />
              </div>
            </div>
          </div>

          <!-- Documentation -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <StickyNote class="h-3.5 w-3.5" /> Documentation
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Public Remarks</Label
                >
                <textarea
                  bind:value={formData.notes}
                  class="h-[100px] w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                ></textarea>
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Private Notes</Label
                >
                <textarea
                  bind:value={formData.notesPrivate}
                  class="h-[100px] w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" href="/admin/transactions/{id}" disabled={isSubmitting}
              >Cancel</Button
            >
            <Button onclick={handleSubmit} disabled={isSubmitting} class="min-w-[120px]">
              {#if isSubmitting}
                <LoaderCircle class="mr-2 h-4 w-4 animate-spin" /> Saving...
              {:else}
                Save Changes
              {/if}
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
