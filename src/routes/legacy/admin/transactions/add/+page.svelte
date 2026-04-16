<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, appendSheetRow } from "$lib/google-sheets";
  import { translatePeriod, translateMop } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import * as Select from "$lib/components/ui/select";
  import { Loader2, ChevronLeft, Search, User, UserCircle } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  // Account Sheet Indices
  const ACC = {
    EMAIL: 0,
    PERIOD: 1,
    ACCOUNT_FULL_NAME: 19,
    CE_STNO: 24,
    CE_FULL_NAME: 25
  };

  interface AccountRecord {
    email: string;
    name: string;
    stNo: string;
    raw: string[];
  }

  let accounts = $state<AccountRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let academicPeriods = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(false);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  // Form State
  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    creatorEmail: "",
    creatorName: "",
    accountEmail: "",
    accountName: "",
    accountStNo: "",
    waterFee: "0",
    assocFee: "0",
    miscFee: "0",
    mop: "CASH",
    period: uiSettings.currentSemester || "",
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

  async function loadAccounts() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:AD");
      const allAccounts = rows
        .slice(1)
        .map((row) => ({
          email: (row[ACC.EMAIL] || "").trim(),
          name: (row[ACC.ACCOUNT_FULL_NAME] || row[ACC.CE_FULL_NAME] || "").trim(),
          stNo: (row[ACC.CE_STNO] || "").toString().trim(),
          raw: row
        }))
        .filter((a) => a.email);

      // Deduplicate by email to avoid repeated names in suggestions
      accounts = Array.from(new Map(allAccounts.map((a) => [a.email, a])).values());

      const constRows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "constants!A:C");
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

      mopTypes = [
        { value: "", label: "N/A" },
        ...constRows
          .slice(1)
          .filter((r) => (r[0] || "").startsWith("MOP_"))
          .map((r) => ({
            value: r[1] || r[0],
            label: translateMop(r[1] || r[0])
          }))
      ];
    } catch (e: any) {
      error = `Failed to load accounts: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadAccounts);

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
    creatorSearch = a.name || a.email;
    showCreatorSuggestions = false;
  }

  function selectAccount(a: AccountRecord) {
    formData.accountEmail = a.email;
    formData.accountName = a.name;
    formData.accountStNo = a.stNo;
    accountSearch = a.name || a.email;
    showAccountSuggestions = false;
  }

  async function handleSubmit() {
    if (!formData.creatorEmail || !formData.accountEmail) {
      error = "Please select both a Creator and an Account.";
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      const txnId = crypto.randomUUID();

      // Mapping to journal_general schema (23 columns, indices 0-22)
      const row = new Array(23).fill("");
      row[0] = formData.date;
      row[1] = formData.creatorEmail;
      row[2] = formData.accountEmail;
      row[3] = formData.waterFee || "0";
      row[4] = formData.assocFee || "0";
      row[5] = formData.miscFee || "0";
      row[6] = formData.mop;
      row[7] = formData.period;
      row[8] = formData.type;
      row[9] = formData.notes;
      row[10] = formData.notesPrivate;
      row[11] = formData.instapayInvoice
        ? `${formData.mopRefNo};${formData.instapayInvoice}`
        : formData.mopRefNo;
      row[12] = ""; // PR_DATE_ISSUED left empty for receipts module

      // PR_REFNO logic based on TYPE and Account
      const prTypes = ["WAIVED", "COLLECTION", "COLLECTION_REFUND", "REFUND"];
      const conditionalPrTypes = [
        "RECLASSIFY",
        "COLLECTION_OTHERS",
        "TRANSFER_TO",
        "TRANSFER_FROM"
      ];

      let prRef = formData.prRefNo;
      const isFunds = formData.accountEmail.toLowerCase().includes("_funds");

      const needsPr =
        prTypes.includes(formData.type) || (conditionalPrTypes.includes(formData.type) && !isFunds);

      if (!needsPr) {
        prRef = "N/A";
      }

      row[13] = prRef || "";
      row[14] = formData.creatorName;
      row[15] = formData.accountName;
      row[16] = formData.accountStNo;

      // Calculate Incoming/Outgoing
      const water = parseFloat(formData.waterFee) || 0;
      const assoc = parseFloat(formData.assocFee) || 0;
      const misc = parseFloat(formData.miscFee) || 0;
      const total = water + assoc + misc;

      if (formData.type === "COLLECTION" || formData.type === "COLLECTION_OTHERS") {
        row[17] = total.toString();
      } else if (formData.type === "REFUND" || formData.type === "WAIVED") {
        row[18] = total.toString();
      }

      row[22] = txnId;

      await appendSheetRow(brandingState.spreadsheetId, "journal_general!A:W", [row]);
      goto("/legacy/admin/transactions");
    } catch (e: any) {
      error = `Submission failed: ${e.message}`;
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl space-y-6">
  <SubpageHeader
    title="Add Transaction"
    subtitle="Create a new entry in the general journal."
    href="/legacy/admin/transactions"
  />

  {#if error}
    <div
      class="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive"
    >
      {error}
    </div>
  {/if}

  <Card.Root>
    <Card.Content class="space-y-8 p-6">
      <!-- Basic Details -->
      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-2">
          <Label>Transaction Date</Label>
          <Input type="date" bind:value={formData.date} />
        </div>
        <div class="space-y-2">
          <Label>Academic Term</Label>
          <Select.Root type="single" bind:value={formData.period}>
            <Select.Trigger class="h-10 text-xs font-semibold">
              {translatePeriod(formData.period) || "Select Term"}
            </Select.Trigger>
            <Select.Content>
              {#each academicPeriods as term}
                <Select.Item value={term.value} label={translatePeriod(term.value)}>
                  {translatePeriod(term.value)}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <!-- Parties -->
      <div class="grid gap-8 border-t pt-4 md:grid-cols-2">
        <div class="relative space-y-3">
          <Label
            class="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >
            <UserCircle class="h-3.5 w-3.5" /> Entry Creator
          </Label>
          <div class="relative">
            <Search class="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              bind:value={creatorSearch}
              onfocus={() => (showCreatorSuggestions = true)}
              onblur={() => setTimeout(() => (showCreatorSuggestions = false), 200)}
              placeholder="Search resident email or name..."
              class="pl-10"
            />
          </div>
          {#if showCreatorSuggestions && creatorSearch && filteredCreators.length > 0}
            <div
              class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-xl"
            >
              {#each filteredCreators as a}
                <button
                  onclick={() => selectCreator(a)}
                  class="flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span class="font-bold text-slate-900">{a.name}</span>
                  <span class="text-[10px] text-muted-foreground">{a.email}</span>
                </button>
              {/each}
            </div>
          {/if}
          <div
            class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
          >
            <div class="flex flex-col">
              <span class="mb-1 text-[10px] leading-none font-bold text-muted-foreground uppercase"
                >Current Selection</span
              >
              <span class="text-xs font-bold text-slate-700"
                >{formData.creatorName || "None selected"}</span
              >
            </div>
          </div>
        </div>

        <div class="relative space-y-3">
          <Label
            class="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >
            <User class="h-3.5 w-3.5" /> Target Account
          </Label>
          <div class="relative">
            <Search class="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              bind:value={accountSearch}
              onfocus={() => (showAccountSuggestions = true)}
              onblur={() => setTimeout(() => (showAccountSuggestions = false), 200)}
              placeholder="Search resident email or name..."
              class="pl-10"
            />
          </div>
          {#if showAccountSuggestions && accountSearch && filteredAccounts.length > 0}
            <div
              class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-xl"
            >
              {#each filteredAccounts as a}
                <button
                  onclick={() => selectAccount(a)}
                  class="flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span class="font-bold text-slate-900">{a.name}</span>
                  <span class="text-[10px] text-muted-foreground">{a.email}</span>
                </button>
              {/each}
            </div>
          {/if}
          <div
            class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
          >
            <div class="flex flex-col">
              <span class="mb-1 text-[10px] leading-none font-bold text-muted-foreground uppercase"
                >Current Selection</span
              >
              <span class="text-xs font-bold text-slate-700"
                >{formData.accountName || "None selected"}</span
              >
              {#if formData.accountStNo}
                <span class="mt-0.5 font-mono text-[9px] text-muted-foreground"
                  >{formData.accountStNo}</span
                >
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Financials -->
      <div class="space-y-4 border-t pt-4">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Financial Details</Label
        >
        <div class="grid gap-6 md:grid-cols-3">
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold">Water Fee</Label>
            <Input
              type="number"
              step="0.01"
              bind:value={formData.waterFee}
              class="text-right font-mono"
            />
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold">Assoc. Fee</Label>
            <Input
              type="number"
              step="0.01"
              bind:value={formData.assocFee}
              class="text-right font-mono"
            />
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold">Misc</Label>
            <Input
              type="number"
              step="0.01"
              bind:value={formData.miscFee}
              class="text-right font-mono"
            />
          </div>
        </div>

        <div class="grid gap-6 pt-2 md:grid-cols-3">
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold">Payment Processor</Label>
            <Select.Root type="single" bind:value={formData.mop}>
              <Select.Trigger class="h-10 text-xs font-semibold">
                {translateMop(formData.mop)}
              </Select.Trigger>
              <Select.Content>
                {#each mopTypes as mop}
                  <Select.Item value={mop.value}>{mop.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold">Type</Label>
            <Select.Root type="single" bind:value={formData.type}>
              <Select.Trigger class="h-10 text-xs font-semibold">
                {formData.type}
              </Select.Trigger>
              <Select.Content>
                {#each transactionTypes as type}
                  <Select.Item value={type.value}>{type.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold">Reference Number</Label>
            <Input bind:value={formData.mopRefNo} placeholder="e.g. Transaction ID" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-[10px] font-bold text-primary">InstaPay Invoice Number</Label>
            <Input bind:value={formData.instapayInvoice} placeholder="Optional" />
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="grid gap-6 border-t pt-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >Public Remarks</Label
          >
          <textarea
            bind:value={formData.notes}
            placeholder="Description for the resident..."
            class="h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          ></textarea>
        </div>
        <div class="space-y-2">
          <Label class="text-xs font-bold tracking-wider text-primary uppercase"
            >Private Notes</Label
          >
          <textarea
            bind:value={formData.notesPrivate}
            placeholder="Internal context only (not visible to resident)..."
            class="h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          ></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t pt-4">
        <Button variant="outline" href="/legacy/admin/transactions" disabled={isSubmitting}
          >Cancel</Button
        >
        <Button onclick={handleSubmit} disabled={isSubmitting} class="min-w-[120px]">
          {#if isSubmitting}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" /> Saving...
          {:else}
            Save Transaction
          {/if}
        </Button>
      </div>
    </Card.Content>
  </Card.Root>
</div>
