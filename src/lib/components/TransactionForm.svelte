<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { SYSTEM_IDS } from "$lib/constants";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import {
    translatePeriod,
    translateMop,
    parseRef,
    formatAmount,
    formatAccounting,
    sortPeriods
  } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Combobox } from "$lib/components/ui/combobox";
  import {
    LoaderCircle,
    Calendar,
    Users,
    Wallet,
    StickyNote,
    Eye,
    Save,
    ArrowLeftToLine,
    TriangleAlert
  } from "lucide-svelte";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import AccountAutocomplete from "$lib/components/AccountAutocomplete.svelte";
  import FinancialStandingCard from "$lib/components/residents/FinancialStandingCard.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Badge } from "$lib/components/ui/badge";
  import { fetchResidents, mapRowToJournal } from "$lib/resident-logic";
  import type { ResidentRecord, JournalRecord } from "$lib/schemas";
  import { JOURNAL_COL as JOR } from "$lib/schemas";

  interface Props {
    mode: "add" | "edit";
    initialData?: JournalRecord | null;
    isSubmitting: boolean;
    onSave: (row: any[]) => Promise<void>;
    onCancel: () => void;
    hideHeader?: boolean;
    onStateChange?: (data: any) => void;
  }

  let {
    mode,
    initialData = null,
    isSubmitting,
    onSave,
    onCancel,
    hideHeader = false,
    onStateChange
  }: Props = $props();

  let accounts = $state<ResidentRecord[]>([]);
  let transactionTypes = $state<{ value: string; val: string; label: string }[]>([]);
  let academicTerms = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  const mopOptions = $derived(mopTypes);
  let isLoading = $state(true);
  let isReady = $state(false);
  let error = $state<string | null>(null);
  let selectedResident = $state<ResidentRecord | null>(null);
  let isStandingOpen = $state(false);
  let allowOverpayment = $state(false);
  let isTermWarningOpen = $state(false);
  let hasConfirmedTerm = $state(false);

  // Form State
  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    creatorEmail: auth.user?.email || "",
    creatorName: auth.displayName || "",
    creatorStNo: "",
    accountEmail: "",
    accountName: "",
    accountStNo: "",
    waterFee: "0",
    assocFee: "0",
    miscFee: "0",
    mop: "CASH",
    period: uiSettings.currentTerm || "",
    type: "PMT_COLLECTION",
    notes: "",
    notesPrivate: "",
    mopRefNo: "",
    instapayInvoice: "",
    receiptUrl: "",
    prDateIssued: "",
    prRefNo: ""
  });

  let carryoverTerm = $state("");
  const isEos = $derived(formData.type === "PMT_EOS");

  $effect(() => {
    if (isEos && formData.mop && uiSettings.accountingWorkbookId) {
      fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "journal_general!A:T").then((rows) => {
        // Compute balances for this MOP exactly copying the financial report code
        const currentSem = formData.period || uiSettings.currentTerm;
        const journal = rows.slice(1).map((r, idx) => {
          return mapRowToJournal(r, idx + 2);
        });

        // 1. Filter out j.type === "EOS" to match financial report page filtering
        const semJournal = journal.filter((j) => {
          return j.period === currentSem && j.type !== "EOS";
        });

        // 2. Data Processing (exact map from financial-report-pdf.ts)
        const processedJournal = semJournal.map((j) => {
          const isWaived = j.type.toUpperCase().includes("WAIVED");
          const amount = j.water + j.assoc + j.misc;
          const incoming = !isWaived && amount > 0 ? amount : 0;
          const outgoing = !isWaived && amount < 0 ? Math.abs(amount) : 0;
          return {
            ...j,
            isWaived,
            incoming,
            outgoing
          };
        });

        // 3. Filter by MOP (exact match from financial-report-pdf.ts)
        const targetMop = formData.mop.trim().toUpperCase();
        const filtered = processedJournal.filter((j) => {
          const rawMop = (j.mop || "").trim().toUpperCase();
          if (rawMop === "N/A") {
            return false;
          }
          const key = rawMop || "CASH";
          return key === targetMop;
        });

        // 4. Compute water, assoc, misc sums (exclude waived and N/A)
        const nonWaivedFiltered = filtered.filter((j) => {
          return !j.isWaived;
        });

        const waterSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + j.water;
        }, 0);
        const assocSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + j.assoc;
        }, 0);
        const miscSum = nonWaivedFiltered.reduce((sum, j) => {
          return sum + j.misc;
        }, 0);

        const waterBal = Math.round(waterSum * 100) / 100;
        const assocBal = Math.round(assocSum * 100) / 100;
        const miscBal = Math.round(miscSum * 100) / 100;

        // Populate fields with negated balances
        formData.waterFee = (-waterBal).toString();
        formData.assocFee = (-assocBal).toString();
        formData.miscFee = (-miscBal).toString();
      });
    }
  });

  const isCollection = $derived.by(() => {
    const type = formData.type;
    return type === "PMT_COLLECTION" || type === "PMT_CN_REFUND" || type === "PMT_WAIVED";
  });

  const waterLimit = $derived.by(() => {
    if (!isCollection || !selectedResident) return 0;
    const base = selectedResident.waterBal;
    const original = mode === "edit" && initialData ? initialData.water : 0;
    return base + original;
  });

  const assocLimit = $derived.by(() => {
    if (!isCollection || !selectedResident) return 0;
    const base = selectedResident.assocBal;
    const original = mode === "edit" && initialData ? initialData.assoc : 0;
    return base + original;
  });

  const currentWaterBal = $derived.by(() => {
    if (!isCollection || !selectedResident) return selectedResident?.waterBal || 0;
    const fee = Number(formData.waterFee) || 0;
    return waterLimit - fee;
  });

  const currentAssocBal = $derived.by(() => {
    if (!isCollection || !selectedResident) return selectedResident?.assocBal || 0;
    const fee = Number(formData.assocFee) || 0;
    return assocLimit - fee;
  });

  const fundsOnlyTypes = [
    "PMT_CARRYOVER",
    "PMT_DISCREPANCY",
    "PMT_EOS",
    "PMT_EOS_UNSETTLED",
    "PMT_PURCHASE",
    "PMT_REFUND",
    "PMT_TRANSPORTATION",
    "PMT_UPLB_ADA_FEE",
    "PMT_WATER_AA",
    "PMT_WATER"
  ];

  const isFundsOnly = $derived(fundsOnlyTypes.includes(formData.type));

  $effect(() => {
    if (!isReady) return;
    const snapshot = $state.snapshot(formData);
    untrack(() => {
      onStateChange?.(snapshot);
    });
  });

  $effect(() => {
    if (isFundsOnly && formData.accountEmail !== "_funds") {
      formData.accountEmail = "_funds";
      formData.accountName = (brandingState.profile.issuerName || "").toUpperCase();
      formData.accountStNo = "SYSTEM";
      accountSearch = (brandingState.profile.issuerName || "").toUpperCase();
      selectedResident = accounts.find((a) => a.email === "_funds") || null;
    }
  });

  $effect(() => {
    formData.period;
    hasConfirmedTerm = false;
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
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    try {
      const [allResidents, constRows] = await Promise.all([
        fetchResidents(),
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C")
      ]);

      const rawAccounts = allResidents;

      const fundsAccount: ResidentRecord = {
        email: "_funds",
        name: (brandingState.profile.issuerName || "").toUpperCase(),
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
        residentId: SYSTEM_IDS.FUNDS,
        ledgerId: SYSTEM_IDS.FUNDS,
        checkInDate: "",
        type: "",
        raw: []
      };

      accounts = Array.from(
        new Map([...rawAccounts, fundsAccount].map((a) => [a.email, a])).values()
      );

      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_") && r[0] !== "PMT_TYPE_RESERVED")
        .map((r) => ({
          value: r[0],
          val: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const termValues = constRows
        .slice(1)
        .filter(
          (r) =>
            (r[0] || "").startsWith("TERM_") && r[0] !== "TERM_CURR" && r[0] !== "TERM_RESERVED"
        )
        .map((r) => r[1] || r[0]);

      academicTerms = sortPeriods(termValues).map((val) => ({
        value: val,
        label: translatePeriod(val)
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

      if (initialData) {
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
          type:
            transactionTypes.find((t) => t.val === initialData!.type)?.value || initialData.type,
          notes: initialData.notes,
          notesPrivate: initialData.notesPrivate,
          mopRefNo: mopRefInfo.reference || initialData.mopRefNo,
          instapayInvoice: mopRefInfo.invoice || "",
          receiptUrl: initialData.receiptUrl || "",
          prDateIssued: initialData.prDateIssued,
          prRefNo: initialData.prRefNo
        };
        creatorSearch = initialData.creatorName || initialData.creator;
        accountSearch = initialData.name || initialData.account;
        selectedResident =
          accounts.find(
            (a) =>
              a.email.toLowerCase() === initialData!.account.toLowerCase() ||
              a.residentId === initialData!.account
          ) || null;

        if (selectedResident) {
          const limitW = selectedResident.waterBal + (mode === "edit" ? initialData.water : 0);
          const limitA = selectedResident.assocBal + (mode === "edit" ? initialData.assoc : 0);
          if (initialData.water > limitW + 0.01 || initialData.assoc > limitA + 0.01) {
            allowOverpayment = true;
          }
        }

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
      isReady = true;
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
    selectedResident = a;
  }

  async function handleSubmit() {
    if (!formData.creatorEmail || !formData.accountEmail) {
      error = "Please select both a Recorder and an Account.";
      return;
    }

    const water = parseFloat(formData.waterFee) || 0;
    const assoc = parseFloat(formData.assocFee) || 0;
    const misc = parseFloat(formData.miscFee) || 0;

    if (water === 0 && assoc === 0 && misc === 0) {
      error = "Transaction must have at least one non-zero amount.";
      return;
    }

    if (misc > 0 && !formData.notes.trim()) {
      error = "Public remarks are required for miscellaneous payments.";
      return;
    }

    if (isCollection && !allowOverpayment) {
      if (water > waterLimit + 0.01) {
        error = `Water payment exceeds remaining balance limit (${formatAmount(waterLimit)}).`;
        return;
      }
      if (assoc > assocLimit + 0.01) {
        error = `Association payment exceeds remaining balance limit (${formatAmount(assocLimit)}).`;
        return;
      }
    }

    if (formData.period !== uiSettings.currentTerm && !hasConfirmedTerm) {
      isTermWarningOpen = true;
      return;
    }

    error = null;

    try {
      const row = new Array(20).fill("");
      row[JOR.DATE] = formData.date;
      row[JOR.CREATOR] = formData.creatorEmail;
      row[JOR.ACCOUNT] = formData.accountEmail;
      const negativeTypes = [
        "PMT_REFUND",
        "PMT_CN_REFUND",
        "PMT_PURCHASE",
        "PMT_WATER",
        "PMT_WATER_AA",
        "PMT_TRANSACTION_FEE",
        "PMT_UPLB_ADA_FEE",
        "PMT_TRANSPORTATION"
      ];
      const isNegative = negativeTypes.includes(formData.type);

      row[JOR.WATER] =
        isNegative && parseFloat(formData.waterFee) !== 0
          ? `-${Math.abs(parseFloat(formData.waterFee))}`
          : formData.waterFee || "0";
      row[JOR.ASSOC] =
        isNegative && parseFloat(formData.assocFee) !== 0
          ? `-${Math.abs(parseFloat(formData.assocFee))}`
          : formData.assocFee || "0";
      row[JOR.MISC] =
        formData.type === "PMT_WAIVED"
          ? "0"
          : isNegative && parseFloat(formData.miscFee) !== 0
            ? `-${Math.abs(parseFloat(formData.miscFee))}`
            : formData.miscFee || "0";
      row[JOR.MOP] =
        formData.type === "PMT_WAIVED" || formData.type === "PMT_DISCREPANCY" ? "" : formData.mop;
      row[JOR.PERIOD] = formData.period;
      const mappedType =
        transactionTypes.find((t) => t.value === formData.type)?.val || formData.type;
      row[JOR.TYPE] = mappedType;
      row[JOR.NOTES] = formData.notes;
      row[JOR.NOTES_PRIVATE] = formData.notesPrivate;
      row[JOR.MOP_REFNO] =
        formData.type === "PMT_WAIVED" || formData.type === "PMT_DISCREPANCY"
          ? ""
          : formData.instapayInvoice
            ? `${formData.mopRefNo};${formData.instapayInvoice}`
            : formData.mopRefNo;
      row[JOR.PR_DATE_ISSUED] = formData.prDateIssued;

      // PR_REFNO logic based on TYPE and Account
      const prTypes = ["WAIVED", "COLLECTION"];
      const conditionalPrTypes = [
        "RECLASSIFY",
        "COLLECTION_OTHERS",
        "TRANSFER_TO",
        "TRANSFER_FROM",
        "COLLECTION_REFUND",
        "REFUND"
      ];

      let prRef = formData.prRefNo;
      const isFunds = formData.accountEmail.toLowerCase().includes("_funds");
      const isRefund = mappedType.toUpperCase().includes("REFUND");

      const needsPr =
        prTypes.includes(mappedType) ||
        ((conditionalPrTypes.includes(mappedType) || isRefund) && !isFunds);

      if (!needsPr) {
        prRef = "N/A";
      }

      row[JOR.PR_REFNO] = prRef || "";
      row[JOR.CREATOR_NAME] = formData.creatorName;
      row[JOR.NAME] = formData.accountName;
      row[JOR.STNO] = formData.accountStNo;
      row[JOR.RECEIPT_URL] = formData.receiptUrl || "";

      if (mode === "edit") {
        row[JOR.WAS_AUDITED] = initialData?.wasAudited ? "TRUE" : "FALSE";
        row[JOR.ID] = initialData?.id;
      } else {
        row[JOR.WAS_AUDITED] = "FALSE";
        row[JOR.ID] = crypto.randomUUID();
      }

      if (mode === "add" && isEos && carryoverTerm) {
        const carryoverRow = new Array(20).fill("");
        carryoverRow[JOR.DATE] = formData.date;
        carryoverRow[JOR.CREATOR] = formData.creatorEmail;
        carryoverRow[JOR.ACCOUNT] = formData.accountEmail;
        carryoverRow[JOR.WATER] = water !== 0 ? (-water).toString() : "0";
        carryoverRow[JOR.ASSOC] = assoc !== 0 ? (-assoc).toString() : "0";
        carryoverRow[JOR.MISC] = misc !== 0 ? (-misc).toString() : "0";
        carryoverRow[JOR.MOP] = formData.mop;
        carryoverRow[JOR.PERIOD] = carryoverTerm;
        const mappedCarryoverType =
          transactionTypes.find((t) => {
            return t.value === "PMT_CARRYOVER";
          })?.val || "PMT_CARRYOVER";
        carryoverRow[JOR.TYPE] = mappedCarryoverType;
        carryoverRow[JOR.NOTES] = "";
        carryoverRow[JOR.NOTES_PRIVATE] = "";
        carryoverRow[JOR.MOP_REFNO] = row[JOR.MOP_REFNO];
        carryoverRow[JOR.PR_DATE_ISSUED] = "";
        carryoverRow[JOR.PR_REFNO] = "N/A";
        carryoverRow[JOR.CREATOR_NAME] = formData.creatorName;
        carryoverRow[JOR.NAME] = formData.accountName;
        carryoverRow[JOR.STNO] = formData.accountStNo;
        carryoverRow[JOR.RECEIPT_URL] = "";
        carryoverRow[JOR.WAS_AUDITED] = "FALSE";
        carryoverRow[JOR.ID] = crypto.randomUUID();

        await onSave([row, carryoverRow]);
      } else {
        await onSave(row);
      }
    } catch (e: any) {
      error = `Submission failed: ${e.message}`;
    }
  }
</script>

<div class="space-y-6">
  {#if !hideHeader}
    <SubpageHeader title={mode === "add" ? "Add Transaction" : "Edit Transaction"} />
  {/if}

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
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Transaction Date</Label
                >
                <Input type="date" bind:value={formData.date} />
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Academic Term</Label
                >
                <Combobox
                  bind:value={formData.period}
                  options={academicTerms}
                  class="h-10 w-full"
                />
                {#if formData.period !== uiSettings.currentTerm}
                  <div
                    class="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs font-bold text-amber-600 uppercase dark:bg-amber-500/20 dark:text-amber-500"
                  >
                    <TriangleAlert class="h-3 w-3" />
                    Caution: Inactive term
                  </div>
                {/if}
              </div>
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Type</Label
              >
              <Combobox bind:value={formData.type} options={transactionTypes} class="h-10 w-full" />
            </div>

            {#if isEos && mode === "add"}
              <div class="animate-in space-y-2 duration-200 fade-in">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Carryover Academic Term</Label
                >
                <Combobox
                  bind:value={carryoverTerm}
                  options={academicTerms}
                  placeholder="Select term to carry over entries to…"
                  class="h-10 w-full"
                />
              </div>
            {/if}
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
                      class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                      >Current Selection</span
                    >
                    <span class="text-xs font-bold text-foreground/80"
                      >{formData.creatorName || "None selected"}</span
                    >
                    {#if formData.creatorStNo}
                      <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                        >{formData.creatorStNo}</span
                      >
                    {/if}
                  </div>
                </div>
              </div>

              {#if !isFundsOnly}
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
                        class="mb-1 text-xs leading-none font-bold text-muted-foreground uppercase"
                        >Current Selection</span
                      >
                      <span class="text-xs font-bold text-foreground/80"
                        >{formData.accountName || "None selected"}</span
                      >
                      {#if formData.accountStNo}
                        <span class="mt-0.5 font-mono text-xs text-muted-foreground"
                          >{formData.accountStNo}</span
                        >
                      {/if}
                    </div>

                    {#if formData.type === "PMT_COLLECTION" && selectedResident && selectedResident.email !== "_funds"}
                      <Dialog.Root bind:open={isStandingOpen}>
                        <Dialog.Trigger>
                          {#snippet child({ props })}
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-8 w-8 text-muted-foreground transition-colors hover:text-primary"
                              {...props}
                              title="View Financial Standing"
                            >
                              <Eye class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Dialog.Trigger>
                        <Dialog.Content class="sm:max-w-[425px]">
                          <Dialog.Header>
                            <Dialog.Title>Financial Standing</Dialog.Title>
                            <Dialog.Description>
                              Current account balances for {selectedResident.name}.
                            </Dialog.Description>
                          </Dialog.Header>
                          <FinancialStandingCard account={selectedResident} hideCard={true} />
                        </Dialog.Content>
                      </Dialog.Root>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Payment Details -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Wallet class="h-3.5 w-3.5" /> Payment Details
            </Label>
            <div class="space-y-4">
              <!-- Water Fee Row -->
              <div class="grid gap-4 {isCollection && selectedResident ? 'md:grid-cols-2' : ''}">
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Water Fee</Label
                  >
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.waterFee}
                      max={isCollection && !allowOverpayment ? waterLimit : undefined}
                      disabled={!formData.accountEmail || isSubmitting || isEos}
                      class="text-right font-mono"
                    />
                    {#if isCollection && selectedResident}
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              variant="outline"
                              size="icon"
                              class="h-9 w-9 shrink-0"
                              {...props}
                              onclick={() => (formData.waterFee = waterLimit.toString())}
                              disabled={waterLimit <= 0 || isSubmitting}
                            >
                              <ArrowLeftToLine class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p class="text-xs font-bold">Set to Maximum</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  </div>
                </div>
                {#if isCollection && selectedResident}
                  <div class="space-y-1.5">
                    <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                      >Remaining Water Balance</Label
                    >
                    <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                      {#if currentWaterBal < 0}
                        <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                      {:else}
                        <span></span>
                      {/if}
                      <div
                        class="font-mono text-sm font-bold {currentWaterBal > 0
                          ? 'text-destructive'
                          : 'text-primary'}"
                      >
                        {formatAccounting(currentWaterBal)}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Association Fee Row -->
              <div class="grid gap-4 {isCollection && selectedResident ? 'md:grid-cols-2' : ''}">
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Association Fee</Label
                  >
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.assocFee}
                      max={isCollection && !allowOverpayment ? assocLimit : undefined}
                      disabled={!formData.accountEmail || isSubmitting || isEos}
                      class="text-right font-mono"
                    />
                    {#if isCollection && selectedResident}
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {#snippet child({ props })}
                            <Button
                              variant="outline"
                              size="icon"
                              class="h-9 w-9 shrink-0"
                              {...props}
                              onclick={() => (formData.assocFee = assocLimit.toString())}
                              disabled={assocLimit <= 0 || isSubmitting}
                            >
                              <ArrowLeftToLine class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </Tooltip.Trigger>
                        <Tooltip.Content>
                          <p class="text-xs font-bold">Set to Maximum</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                  </div>
                </div>
                {#if isCollection && selectedResident}
                  <div class="space-y-1.5">
                    <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                      >Remaining Association Balance</Label
                    >
                    <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                      {#if currentAssocBal < 0}
                        <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                      {:else}
                        <span></span>
                      {/if}
                      <div
                        class="font-mono text-sm font-bold {currentAssocBal > 0
                          ? 'text-destructive'
                          : 'text-primary'}"
                      >
                        {formatAccounting(currentAssocBal)}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              {#if formData.type !== "PMT_WAIVED"}
                <!-- Misc Fee Row -->
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Misc</Label
                  >
                  <Input
                    type="number"
                    step="0.01"
                    bind:value={formData.miscFee}
                    disabled={!formData.accountEmail || isSubmitting || isEos}
                    class="text-right font-mono"
                  />
                </div>
              {/if}

              {#if isCollection && selectedResident && selectedResident.email !== "_funds"}
                <div
                  class="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <Checkbox id="allowOverpayment" bind:checked={allowOverpayment} />
                  <div class="grid gap-0.5">
                    <Label for="allowOverpayment" class="cursor-pointer">Allow Overpayment</Label>
                    <p class="text-xs leading-tight text-muted-foreground">
                      Override balance validation for water and association fees.
                    </p>
                  </div>
                </div>
              {/if}
            </div>

            {#if formData.type !== "PMT_WAIVED" && formData.type !== "PMT_DISCREPANCY"}
              <div class="grid gap-6 pt-2">
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Payment Processor</Label
                  >
                  <Combobox
                    bind:value={formData.mop}
                    options={mopOptions}
                    disabled={!formData.accountEmail || isSubmitting}
                    class="h-10 w-full"
                  />
                </div>
              </div>
            {/if}

            {#if formData.type !== "PMT_WAIVED" && formData.type !== "PMT_DISCREPANCY"}
              <div class="grid gap-6 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Reference Number</Label
                  >
                  <Input
                    bind:value={formData.mopRefNo}
                    disabled={!formData.accountEmail || isSubmitting}
                    placeholder="e.g., Transaction ID"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >InstaPay Invoice Number</Label
                  >
                  <Input
                    bind:value={formData.instapayInvoice}
                    disabled={!formData.accountEmail || isSubmitting}
                    placeholder="Optional"
                  />
                </div>
              </div>
            {/if}
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
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Public Remarks</Label
                >
                <Textarea
                  bind:value={formData.notes}
                  placeholder="Description for the resident…"
                  class="h-[120px] text-xs"
                />
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
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
            <Button variant="outline" onclick={onCancel} isLoading={isSubmitting}>Cancel</Button>
            <Button
              onclick={handleSubmit}
              disabled={!formData.accountEmail}
              isLoading={isSubmitting}
              icon={Save}
              class="min-w-[120px]"
            >
              Save
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>

<AlertDialog.Root bind:open={isTermWarningOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Non-Active Term Warning</AlertDialog.Title>
      <AlertDialog.Description>
        You are recording a transaction for <span class="font-bold text-foreground"
          >{translatePeriod(formData.period)}</span
        >, which is not the currently active term (<span class="font-bold text-foreground"
          >{translatePeriod(uiSettings.currentTerm)}</span
        >). Are you sure you want to proceed?
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Review Entry</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={() => {
          hasConfirmedTerm = true;
          handleSubmit();
        }}
        class="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
      >
        Yes, Proceed
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
