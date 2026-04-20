<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { translatePeriod, translateMop, parseRef } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { LoaderCircle, Calendar, Users, Wallet, StickyNote } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import AccountAutocomplete from "$lib/components/AccountAutocomplete.svelte";
  import { mapRowToResident } from "$lib/resident-logic";
  import type { ResidentRecord, JournalRecord } from "$lib/schemas";
  import { JOURNAL_COL as JOR } from "$lib/schemas";

  interface Props {
    mode: "add" | "edit";
    initialData?: JournalRecord | null;
    isSubmitting: boolean;
    onSave: (row: any[]) => Promise<void>;
    onCancel: () => void;
  }

  let { mode, initialData = null, isSubmitting, onSave, onCancel }: Props = $props();

  let accounts = $state<ResidentRecord[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let academicPeriods = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Form State
  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    creatorEmail: auth.user?.email || "",
    creatorName: auth.user?.name || "",
    creatorStNo: "",
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

  // Display initial creator if set (for "add" mode mostly)
  $effect(() => {
    if (mode === "add" && formData.creatorEmail && !creatorSearch) {
      creatorSearch = formData.creatorEmail;
    }
  });

  // Autocomplete State
  let creatorSearch = $state("");
  let accountSearch = $state("");

  async function loadData() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    try {
      const [accRows, constRows] = await Promise.all([
        fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:AD"),
        fetchSheetRowsRaw(brandingState.spreadsheetId, "constants!A:C")
      ]);

      const rawAccounts = accRows
        .slice(1)
        .map((row) => mapRowToResident(row))
        .filter((a) => a.email && a.email.toLowerCase() !== "email");

      const fundsAccount: ResidentRecord = {
        email: "_funds",
        name: "Association Funds",
        stno: "SYSTEM",
        period: "ALWAYS",
        room: "",
        bed: "",
        waterBase: 0,
        waterPaid: 0,
        waterWaived: 0,
        waterBal: 0,
        assocBase: 0,
        assocPaid: 0,
        assocWaived: 0,
        assocBal: 0,
        totalBase: 0,
        paid: 0,
        waived: 0,
        bal: 0,
        isFullyPaid: true,
        notes: "",
        college: "",
        program: "",
        ceIssued: "",
        ceRefNo: "",
        ceLink: "",
        ceFullName: "",
        raw: []
      };

      accounts = Array.from(
        new Map([...rawAccounts, fundsAccount].map((a) => [a.email, a])).values()
      );

      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_") && r[0] !== "PMT_TYPE_RESERVED")
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      academicPeriods = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("SEM_"))
        .filter((r) => !r[1]?.includes("DO_NOT_USE") && !r[2]?.includes("DO_NOT_USE"))
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

      if (mode === "edit" && initialData) {
        const mopRefInfo = parseRef(initialData.mopRefNo);
        formData = {
          date: initialData.date,
          creatorEmail: initialData.creator,
          creatorName: initialData.creatorName,
          creatorStNo: "", // Resolving below
          accountEmail: initialData.account,
          accountName: initialData.name,
          accountStNo: initialData.stno,
          waterFee: initialData.water.toString(),
          assocFee: initialData.assoc.toString(),
          miscFee: initialData.misc.toString(),
          mop: initialData.mop,
          period: initialData.period,
          type: initialData.type,
          notes: initialData.notes,
          notesPrivate: initialData.notesPrivate,
          mopRefNo: mopRefInfo.reference || initialData.mopRefNo,
          instapayInvoice: mopRefInfo.invoice || "",
          prDateIssued: initialData.prDateIssued,
          prRefNo: initialData.prRefNo
        };
        creatorSearch = initialData.creator;
        accountSearch = initialData.account;

        // Resolve creator student number
        const creatorAcc = accounts.find(
          (a) => a.email.toLowerCase() === initialData!.creator.toLowerCase()
        );
        if (creatorAcc) {
          formData.creatorStNo = creatorAcc.stno;
        }
      } else if (mode === "add") {
        // Populate current user stNo and official name if matching
        const userMail = auth.user?.email;
        if (userMail) {
          const myAcc = accounts.find((a) => a.email.toLowerCase() === userMail.toLowerCase());
          if (myAcc) {
            formData.creatorStNo = myAcc.stno;
            formData.creatorName = myAcc.name;
            creatorSearch = myAcc.email;
          }
        }
      }
    } catch (e: any) {
      error = `Failed to load data: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  function selectCreator(a: ResidentRecord) {
    formData.creatorEmail = a.email;
    formData.creatorName = a.name;
    formData.creatorStNo = a.stno;
    creatorSearch = a.name;
  }

  function selectAccount(a: ResidentRecord) {
    formData.accountEmail = a.email;
    formData.accountName = a.name;
    formData.accountStNo = a.stno;
    accountSearch = a.name;
  }

  async function handleSubmit() {
    if (!formData.creatorEmail || !formData.accountEmail) {
      error = "Please select both a Creator and an Account.";
      return;
    }

    error = null;

    try {
      const row = new Array(23).fill("");
      row[JOR.DATE] = formData.date;
      row[JOR.CREATOR] = formData.creatorEmail;
      row[JOR.ACCOUNT] = formData.accountEmail;
      row[JOR.WATER] = formData.waterFee || "0";
      row[JOR.ASSOC] = formData.assocFee || "0";
      row[JOR.MISC] = formData.miscFee || "0";
      row[JOR.MOP] = formData.mop;
      row[JOR.PERIOD] = formData.period;
      row[JOR.TYPE] = formData.type;
      row[JOR.NOTES] = formData.notes;
      row[JOR.NOTES_PRIVATE] = formData.notesPrivate;
      row[JOR.MOP_REFNO] = formData.instapayInvoice
        ? `${formData.mopRefNo};${formData.instapayInvoice}`
        : formData.mopRefNo;
      row[JOR.PR_DATE_ISSUED] = formData.prDateIssued;

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

      row[JOR.PR_REFNO] = prRef || "";
      row[JOR.CREATOR_NAME] = formData.creatorName;
      row[JOR.NAME] = formData.accountName;
      row[JOR.STNO] = formData.accountStNo;

      if (mode === "edit") {
        row[JOR.WAS_AUDITED] = "FALSE";
        row[JOR.ID] = initialData?.id;
      } else {
        row[JOR.ID] = crypto.randomUUID();
      }

      await onSave(row);
    } catch (e: any) {
      error = `Submission failed: ${e.message}`;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title={mode === "add" ? "Add Transaction" : "Edit Transaction"} />

  <div class="mx-auto max-w-3xl space-y-6">
    {#if error}
      <ErrorView {error} class="mb-4">
        {#if accounts.length === 0}
          <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}
            >Try Again</Button
          >
        {/if}
      </ErrorView>
    {/if}

    {#if isLoading}
      <div class="flex h-64 items-center justify-center">
        <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    {:else}
      <Card.Root>
        <Card.Content class="space-y-8">
          <!-- Basic Details -->
          <div class="space-y-4 pt-4">
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
            <div class="space-y-2">
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

          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Users class="h-3.5 w-3.5" /> Transaction Parties
            </Label>
            <div class="grid gap-8 md:grid-cols-2">
              <div class="relative space-y-3">
                <AccountAutocomplete
                  label="Recorder"
                  placeholder="Search resident email or name…"
                  {accounts}
                  filter={(a) => !formData.period || a.period === formData.period}
                  onSelect={selectCreator}
                  bind:value={creatorSearch}
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
                      >{formData.creatorName || "None selected"}</span
                    >
                    {#if formData.creatorStNo}
                      <span class="mt-0.5 font-mono text-[9px] text-muted-foreground"
                        >{formData.creatorStNo}</span
                      >
                    {/if}
                  </div>
                </div>
              </div>

              <div class="relative space-y-3">
                <AccountAutocomplete
                  label="Account"
                  placeholder="Search resident email or name…"
                  {accounts}
                  filter={(a) =>
                    a.email === "_funds" || !formData.period || a.period === formData.period}
                  onSelect={selectAccount}
                  bind:value={accountSearch}
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
          </div>

          <!-- Payment Details -->
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
                  >Association Fee</Label
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
                  >Misc</Label
                >
                <Input
                  type="number"
                  step="0.01"
                  bind:value={formData.miscFee}
                  class="text-right font-mono"
                />
              </div>
            </div>

            <div class="grid gap-6 pt-2 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Payment Processor</Label
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
            </div>

            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Reference Number</Label
                >
                <Input bind:value={formData.mopRefNo} placeholder="e.g., Transaction ID" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >InstaPay Invoice Number</Label
                >
                <Input bind:value={formData.instapayInvoice} placeholder="Optional" />
              </div>
            </div>
          </div>

          <!-- Notes -->
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
                <Textarea
                  bind:value={formData.notes}
                  placeholder="Description for the resident…"
                  class="h-[120px] text-xs"
                />
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                  >Private Notes</Label
                >
                <Textarea
                  bind:value={formData.notesPrivate}
                  placeholder="Internal context only (not visible to resident)…"
                  class="h-[120px] text-xs"
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onclick={onCancel} disabled={isSubmitting}>Cancel</Button>
            <Button onclick={handleSubmit} disabled={isSubmitting} class="min-w-[120px]">
              {#if isSubmitting}
                <LoaderCircle class="mr-2 h-4 w-4 animate-spin" /> Saving...
              {:else}
                {mode === "add" ? "Save" : "Save Changes"}
              {/if}
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
