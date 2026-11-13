<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { page } from "$app/state";
  import { brandingState } from "$state/branding.svelte";
  import { settings } from "$state/settings.svelte";
  import { SYSTEM_IDS } from "$lib/constants";
  import { fetchJournalEntries } from "$api/controllers/journal-controller";
  import { fetchConstants, fetchTerms } from "$api/controllers/constants-controller";
  import { translatePeriod, translateMop } from "$utils/translators";
  import { parseRef } from "$utils/parsers";
  import { formatAmount, formatAccounting } from "$utils/formatters";
  import { sortPeriods } from "$utils/sort";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { Combobox } from "$ui/combobox";
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
  } from "@lucide/svelte";
  import { Checkbox } from "$ui/checkbox";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { AccountCombobox } from "$components/ui/haone";
  import FinancialStandingCard from "$components/residents/FinancialStandingCard.svelte";
  import * as Dialog from "$ui/dialog";
  import * as Tooltip from "$ui/tooltip";
  import { Badge } from "$ui/badge";
  import { fetchResidents } from "$api/controllers/resident-controller";
  import { feeCodesState } from "$state/fee-codes.svelte";
  import {
    FeeCode,
    TransactionType,
    TRANSACTION_TYPE_OPTIONS,
    TRANSACTION_TYPE_FUNDS_ONLY,
    getJournalFeeValue,
    type ResidentRecord,
    type JournalRecord,
    TRANSACTION_TYPE_WITH_RECEIPT,
    TRANSACTION_TYPE_MAYBE_WITH_RECEIPT
  } from "$lib/types";
  import { globalDialog } from "$state/dialog.svelte";
  import { toast } from "svelte-sonner";

  interface Props {
    mode: "add" | "edit";
    initialData?: JournalRecord | null;
    isSubmitting: boolean;
    onSave: (entry: Partial<JournalRecord> | Partial<JournalRecord>[]) => Promise<void>;
    hideHeader?: boolean;
    onStateChange?: (data: any) => void;
  }

  let {
    mode,
    initialData = null,
    isSubmitting,
    onSave,
    hideHeader = false,
    onStateChange
  }: Props = $props();

  let accounts = $state<ResidentRecord[]>([]);
  let academicTerms = $state<{ value: string; label: string }[]>([]);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  const mopOptions = $derived(mopTypes);
  let isLoading = $state(true);
  let isReady = $state(false);
  let error = $state<string | null>(null);
  let selectedResident = $state<ResidentRecord | null>(null);
  let isStandingOpen = $state(false);
  let allowOverpayment = $state(false);
  let hasConfirmedTerm = $state(false);

  // Form State
  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    creatorName: auth.displayNameLastFirst || "",
    creatorStNo: "",
    creatorId: "",
    accountName: "",
    accountStNo: "",
    accountId: "",
    fees: Object.fromEntries(feeCodesState.codes.map((k) => [k, "0"])) as Record<FeeCode, string>,
    mop: "CASH",
    mopTo: "CASH",
    period: settings.currentTerm || "",
    type: TransactionType.COLLECTION,
    notes: "",
    notesPrivate: "",
    mopRefNo: "",
    instapayInvoice: "",
    receiptUrl: "",
    prDateIssued: "",
    prRefNo: ""
  });

  let carryoverTerm = $state("");
  const isEos = $derived(
    formData.type === TransactionType.EOS || formData.type === TransactionType.EOS_UNSETTLED
  );

  const typeOptions = $derived([
    ...TRANSACTION_TYPE_OPTIONS.filter((t) => {
      if (t.value === formData.type) {
        return true;
      }
      return (
        t.value !== TransactionType.CARRYOVER &&
        t.value !== TransactionType.TRANSFER_FROM &&
        t.value !== TransactionType.TRANSFER_TO
      );
    })
  ]);

  const isTypeDisabled = $derived(
    isSubmitting ||
      formData.type === TransactionType.TRANSFER_FROM ||
      formData.type === TransactionType.TRANSFER_TO ||
      formData.type === TransactionType.CARRYOVER
  );

  const carryoverAcademicTerms = $derived.by(() => {
    if (!formData.period) {
      return [];
    }
    const getWeight = (p: string) => {
      const match = p.match(/^(\d{2})(\d{2})_(MY|[1-3]S)$/);
      if (!match) {
        return 0;
      }
      const year = parseInt(match[1]);
      const term = match[3];
      const termWeight = term === "MY" ? 3 : term === "2S" ? 2 : term === "1S" ? 1 : 0;
      return year * 10 + termWeight;
    };
    const currentWeight = getWeight(formData.period);
    return academicTerms.filter((t) => {
      return getWeight(t.value) > currentWeight;
    });
  });

  $effect(() => {
    if (isEos && formData.mop) {
      fetchJournalEntries().then((entries) => {
        const currentTerm = formData.period || settings.currentTerm;
        const journal = Array.isArray(entries) ? entries : entries.items;

        const termJournal = journal.filter((j) => {
          return j.period === currentTerm && j.type !== "EOS" && j.type !== "EOS_UNSETTLED";
        });

        const targetMop = formData.mop.trim().toUpperCase();
        const nonWaivedFiltered = termJournal.filter((j) => {
          const isWaived = j.type.toUpperCase().includes("WAIVED");
          if (isWaived) {
            return false;
          }
          const rawMop = (j.mop || "").trim().toUpperCase();
          if (rawMop === "N/A") {
            return false;
          }
          const key = rawMop || "CASH";
          return key === targetMop;
        });

        for (const code of feeCodesState.codes) {
          const feeSum = nonWaivedFiltered.reduce((sum, j) => {
            return sum + getJournalFeeValue(j, code);
          }, 0);
          const feeBal = Math.round(feeSum * 100) / 100;
          formData.fees[code] = (-feeBal).toString();
        }
      });
    }
  });

  const isCollection = $derived.by(() => {
    const type = formData.type;
    return (
      type === TransactionType.COLLECTION ||
      type === TransactionType.REFUND_COLLECTION ||
      type === TransactionType.WAIVED
    );
  });

  function getFeeLimit(code: FeeCode): number {
    const cfg = feeCodesState.byCode[code];
    if (!isCollection || !selectedResident || !cfg?.isMandatory) {
      return 0;
    }
    const base = selectedResident.feeBalances?.[code]?.balance || 0;
    const original = mode === "edit" && initialData ? getJournalFeeValue(initialData, code) : 0;
    return base + original;
  }

  function getCurrentFeeBal(code: FeeCode): number {
    const cfg = feeCodesState.byCode[code];
    if (!cfg?.isMandatory) {
      return 0;
    }
    if (!isCollection || !selectedResident) {
      return selectedResident ? selectedResident.feeBalances?.[code]?.balance || 0 : 0;
    }
    const fee = Number(formData.fees[code]) || 0;
    return getFeeLimit(code) - fee;
  }

  const isFundsOnly = $derived(
    TRANSACTION_TYPE_FUNDS_ONLY.includes(formData.type as TransactionType)
  );

  $effect(() => {
    if (!isReady) return;
    const snapshot = $state.snapshot(formData);
    untrack(() => {
      onStateChange?.(snapshot);
    });
  });

  $effect(() => {
    if (isFundsOnly && formData.accountId !== SYSTEM_IDS.FUNDS) {
      formData.accountName = (brandingState.profile.issuerName || "").toUpperCase();
      formData.accountId = SYSTEM_IDS.FUNDS;
      accountSearch = (brandingState.profile.issuerName || "").toUpperCase();
      selectedResident = accounts.find((a) => a.email === "_funds") || null;
    }
  });

  $effect(() => {
    formData.period;
    hasConfirmedTerm = false;
  });

  // Autocomplete State
  let creatorSearch = $state("");
  let accountSearch = $state("");

  async function loadData() {
    isLoading = true;
    try {
      const [allResidents, constants] = await Promise.all([fetchResidents(), fetchConstants()]);

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
        id: SYSTEM_IDS.FUNDS,
        residentId: SYSTEM_IDS.FUNDS,
        ledgerId: SYSTEM_IDS.FUNDS,
        checkInDate: "",
        type: "FUNDS" as any,
        raw: []
      };

      accounts = Array.from(
        new Map([...rawAccounts, fundsAccount].map((a) => [a.email, a])).values()
      );

      const termRecords = await fetchTerms();
      const termValues = termRecords.map((t) => String(t.termId));

      academicTerms = sortPeriods(termValues).map((val) => ({
        value: val,
        label: translatePeriod(val)
      }));

      mopTypes = [
        { value: "", label: "N/A" },
        ...constants
          .filter((r) => r.key.startsWith("MOP_"))
          .map((r) => ({
            value: r.value || r.key,
            label: translateMop(r.value || r.key)
          }))
      ];

      if (initialData) {
        const mopRefInfo = parseRef(initialData.mopRefNo);
        const initialFees = Object.fromEntries(
          feeCodesState.codes.map((code) => [
            code,
            getJournalFeeValue(initialData, code).toString()
          ])
        ) as Record<FeeCode, string>;

        formData = {
          date: initialData.date,
          creatorName: initialData.creatorName,
          creatorStNo: "", // Resolving below
          creatorId: initialData.creatorId || "",
          accountName: initialData.name,
          accountStNo: initialData.stno,
          accountId: initialData.accountId || "",
          fees: initialFees,
          mop: initialData.mop,
          mopTo: (initialData as any).mopTo || "CASH",
          period: initialData.period,
          type:
            (TRANSACTION_TYPE_OPTIONS.find((t) => t.value === initialData!.type)
              ?.value as TransactionType) || initialData.type,
          notes: initialData.notes,
          notesPrivate: initialData.notesPrivate,
          mopRefNo: mopRefInfo.reference || initialData.mopRefNo,
          instapayInvoice: mopRefInfo.invoice || "",
          receiptUrl: initialData.receipt?.receiptUrl || "",
          prDateIssued: initialData.receipt?.dateIssued || "",
          prRefNo: initialData.receipt?.id || ""
        };
        creatorSearch = initialData.creatorName || initialData.creator;
        accountSearch = initialData.name || initialData.account;
        selectedResident =
          accounts.find(
            (a) =>
              (initialData!.accountId &&
                (a.residentId === initialData!.accountId || a.id === initialData!.accountId)) ||
              a.email.toLowerCase() === initialData!.account.toLowerCase() ||
              a.residentId === initialData!.account
          ) || null;

        if (selectedResident) {
          for (const code of feeCodesState.codes) {
            const cfg = feeCodesState.byCode[code];
            if (cfg.isMandatory) {
              const val = getJournalFeeValue(initialData, code);
              const limit =
                (selectedResident.feeBalances?.[code]?.balance || 0) + (mode === "edit" ? val : 0);
              if (val > limit + 0.01) {
                allowOverpayment = true;
              }
            }
          }
          if (!formData.accountId) {
            formData.accountId = selectedResident.residentId || selectedResident.id;
          }
        }

        // Resolve creator student number and id
        const creatorAcc = accounts.find(
          (a) =>
            initialData!.creatorId &&
            (a.residentId === initialData!.creatorId || a.id === initialData!.creatorId)
        );
        if (creatorAcc) {
          formData.creatorStNo = creatorAcc.stno;
          if (!formData.creatorId) {
            formData.creatorId = creatorAcc.residentId || creatorAcc.id;
          }
          if (!formData.creatorName) {
            formData.creatorName = creatorAcc.name;
          }
        }
      } else if (auth.user) {
        formData.creatorStNo = auth.user.studentNo;
        formData.creatorName = auth.displayNameLastFirst;
        formData.creatorId = auth.userId;
        creatorSearch = auth.displayNameLastFirst;
      }

      // Pre-fill target account from query parameters if provided
      const targetAccountParam = page.url.searchParams.get("account");
      if (targetAccountParam) {
        const targetAcc = accounts.find(
          (a) =>
            (a.residentId && a.residentId.toLowerCase() === targetAccountParam.toLowerCase()) ||
            (a.stno && a.stno.toLowerCase() === targetAccountParam.toLowerCase()) ||
            (a.email && a.email.toLowerCase() === targetAccountParam.toLowerCase())
        );
        if (targetAcc) {
          selectAccount(targetAcc);
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
    formData.creatorName = a.name;
    formData.creatorStNo = a.stno;
    formData.creatorId = a.residentId;
    creatorSearch = a.name;
  }

  function selectAccount(a: ResidentRecord) {
    formData.accountName = a.name;
    formData.accountStNo = a.stno;
    formData.accountId = a.residentId;
    accountSearch = a.name;
    selectedResident = a;
  }

  function confirmSubmitForInactiveTerm() {
    globalDialog.confirm(
      "Record transaction for inactive term?",
      `This transaction will be recorded under ${translatePeriod(formData.period)} instead of the active term (${translatePeriod(settings.activeTerm)}).`,
      undefined,
      async () => {
        try {
          hasConfirmedTerm = true;
          await handleSubmit();
        } catch (e: any) {
          toast.error(e.message);
        }
      },
      undefined,
      {
        accept: "Record transaction",
        cancel: "Cancel"
      }
    );
  }

  async function handleSubmit() {
    if (!formData.creatorId || !formData.accountId) {
      error = "Please select both a Recorder and an Account.";
      return;
    }

    if (formData.type === TransactionType.FUND_TRANSFER && formData.mop === formData.mopTo) {
      error = "Source (From) and destination (To) payment processors cannot be the same.";
      return;
    }

    const parsedFees = feeCodesState.codes.map((code) => ({
      feeCode: code,
      value: parseFloat(formData.fees[code]) || 0
    }));

    if (parsedFees.every((item) => item.value === 0)) {
      error = "Transaction must have at least one non-zero amount.";
      return;
    }

    const isTransfer =
      formData.type === TransactionType.FUND_TRANSFER ||
      formData.type === TransactionType.TRANSFER_FROM ||
      formData.type === TransactionType.TRANSFER_TO;

    const miscVal = parsedFees.find((item) => item.feeCode === FeeCode.MISC)?.value || 0;
    if (!isTransfer && miscVal > 0 && !formData.notes.trim()) {
      error = "Public remarks are required for miscellaneous payments.";
      return;
    }

    if (isCollection && !allowOverpayment) {
      for (const item of parsedFees) {
        const cfg = feeCodesState.byCode[item.feeCode];
        if (cfg.isMandatory) {
          const limit = getFeeLimit(item.feeCode);
          if (item.value > limit + 0.01) {
            error = `${cfg.shortLabel} payment exceeds remaining balance limit (${formatAmount(limit)}).`;
            return;
          }
        }
      }
    }

    if (formData.period !== settings.currentTerm && !hasConfirmedTerm) {
      confirmSubmitForInactiveTerm();
      return;
    }

    error = null;

    try {
      const mopRefNo = formData.instapayInvoice
        ? `${formData.mopRefNo};${formData.instapayInvoice}`
        : formData.mopRefNo;

      if (formData.type === TransactionType.FUND_TRANSFER) {
        const fromId = mode === "edit" && initialData ? initialData.id : crypto.randomUUID();
        const fromItems = parsedFees
          .filter((item) => item.value !== 0)
          .map((item) => ({ feeCode: item.feeCode, value: -Math.abs(item.value) }));
        const toId = crypto.randomUUID();
        const toItems = parsedFees
          .filter((item) => item.value !== 0)
          .map((item) => ({ feeCode: item.feeCode, value: Math.abs(item.value) }));

        const fromEntry: Partial<JournalRecord> = {
          id: fromId,
          date: formData.date,
          mop: formData.mop,
          period: formData.period,
          type: TransactionType.TRANSFER_FROM,
          notes: formData.notes,
          notesPrivate: formData.notesPrivate,
          mopRefNo,
          receipt: null,
          wasAudited: mode === "edit" && initialData?.wasAudited ? true : false,
          creatorId: formData.creatorId || "",
          accountId: formData.accountId || "",
          items: fromItems,
          amount: fromItems.reduce((sum, item) => sum + item.value, 0)
        };

        const toEntry: Partial<JournalRecord> = {
          id: toId,
          date: formData.date,
          mop: formData.mopTo,
          period: formData.period,
          type: TransactionType.TRANSFER_TO,
          notes: formData.notes,
          notesPrivate: formData.notesPrivate,
          mopRefNo,
          receipt: null,
          wasAudited: false,
          creatorId: formData.creatorId || "",
          accountId: formData.accountId || "",
          items: toItems,
          amount: toItems.reduce((sum, item) => sum + item.value, 0)
        };

        await onSave([fromEntry, toEntry]);
        return;
      }

      const negativeTypes: string[] = [
        TransactionType.REFUND,
        TransactionType.REFUND_COLLECTION,
        TransactionType.PURCHASE,
        TransactionType.WATER,
        TransactionType.WATER_AA,
        TransactionType.TRANSACTION_FEE,
        TransactionType.UPLB_ADA_FEE,
        TransactionType.TRANSPORTATION
      ];
      const isNegative = negativeTypes.includes(formData.type);

      const items = parsedFees
        .map((item) => {
          const cfg = feeCodesState.byCode[item.feeCode];
          if (formData.type === TransactionType.WAIVED && !cfg.canWaive) {
            return { feeCode: item.feeCode, value: 0 };
          }
          if (item.value === 0) {
            return { feeCode: item.feeCode, value: 0 };
          }
          return {
            feeCode: item.feeCode,
            value: isNegative ? -Math.abs(item.value) : item.value
          };
        })
        .filter((item) => item.value !== 0);

      const mappedType: TransactionType =
        (TRANSACTION_TYPE_OPTIONS.find((t) => t.value === formData.type)
          ?.value as TransactionType) || formData.type;

      const isFunds = formData.accountId === SYSTEM_IDS.FUNDS;
      const isRefund =
        mappedType === TransactionType.REFUND || mappedType === TransactionType.REFUND_COLLECTION;

      const needsPr =
        TRANSACTION_TYPE_WITH_RECEIPT.includes(mappedType) ||
        ((TRANSACTION_TYPE_MAYBE_WITH_RECEIPT.includes(mappedType) || isRefund) && !isFunds);

      const entryId = mode === "edit" && initialData ? initialData.id : crypto.randomUUID();
      const entryMop =
        formData.type === TransactionType.WAIVED || formData.type === TransactionType.DISCREPANCY
          ? ""
          : formData.mop;
      const entryMopRef =
        formData.type === TransactionType.WAIVED || formData.type === TransactionType.DISCREPANCY
          ? ""
          : mopRefNo;

      const mainEntry: Partial<JournalRecord> = {
        id: entryId,
        date: formData.date,
        mop: entryMop,
        period: formData.period,
        type: mappedType,
        notes: formData.notes,
        notesPrivate: formData.notesPrivate,
        mopRefNo: entryMopRef,
        receipt: needsPr
          ? {
              id: formData.prRefNo || initialData?.receipt?.id || crypto.randomUUID(),
              groupId: entryId,
              dateIssued: formData.prDateIssued || null,
              receiptUrl: formData.receiptUrl || null
            }
          : null,
        wasAudited: mode === "edit" && initialData?.wasAudited ? true : false,
        creatorId: formData.creatorId || "",
        accountId: formData.accountId || "",
        items,
        amount: items.reduce((sum, item) => sum + item.value, 0)
      };

      if (mode === "add" && isEos && carryoverTerm) {
        const carryoverId = crypto.randomUUID();
        const carryoverItems = parsedFees
          .filter((item) => item.value !== 0)
          .map((item) => ({ feeCode: item.feeCode, value: -item.value }));
        const mappedCarryoverType =
          TRANSACTION_TYPE_OPTIONS.find((t) => {
            return t.value === TransactionType.CARRYOVER;
          })?.value || TransactionType.CARRYOVER;

        const carryoverEntry: Partial<JournalRecord> = {
          id: carryoverId,
          date: formData.date,
          mop: formData.mop,
          period: carryoverTerm,
          type: mappedCarryoverType,
          notes: "",
          notesPrivate: "",
          mopRefNo: entryMopRef,
          receipt: null,
          wasAudited: false,
          creatorId: formData.creatorId || "",
          accountId: formData.accountId || "",
          items: carryoverItems,
          amount: carryoverItems.reduce((sum, item) => sum + item.value, 0)
        };

        await onSave([mainEntry, carryoverEntry]);
      } else {
        await onSave(mainEntry);
      }
    } catch (e: any) {
      error = `Submission failed: ${e.message}`;
    }
  }
</script>

<!-- FIXME: Subpage header should not be handled by this component -->
<div class="mx-auto max-w-7xl space-y-3">
  {#if !hideHeader}
    <ContentHeader title={mode === "add" ? "Add Transaction" : "Edit Transaction"} />
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
          <div class="space-y-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Calendar class="h-3.5 w-3.5" /> General Information
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Transaction Date</Label>
                <Input type="date" bind:value={formData.date} />
              </div>
              <div class="space-y-2">
                <Label>Academic Term</Label>
                <Combobox bind:value={formData.period} options={academicTerms} class="w-full" />
                {#if formData.period !== settings.currentTerm}
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
              <Label>Type</Label>
              <Combobox
                bind:value={formData.type}
                options={typeOptions}
                disabled={isTypeDisabled}
                class="w-full"
              />
              {#if isTypeDisabled && !isSubmitting}
                <p class="mt-1 text-xs text-muted-foreground">
                  This is a special transaction type and cannot be changed.
                </p>
              {/if}
            </div>

            {#if isEos && mode === "add"}
              <div class="animate-in space-y-2 duration-200 fade-in">
                <Label>Carryover Academic Term</Label>
                <Combobox
                  bind:value={carryoverTerm}
                  options={carryoverAcademicTerms}
                  placeholder="Select term to carry over entries to…"
                  class="w-full"
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
                <AccountCombobox
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
                  <AccountCombobox
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

                    {#if formData.type === TransactionType.COLLECTION && selectedResident && selectedResident.email !== "_funds"}
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
                        <Dialog.Content class="sm:max-w-106.25">
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
              {#each feeCodesState.codes as code (code)}
                {@const cfg = feeCodesState.byCode[code]}
                {#if formData.type !== TransactionType.WAIVED || cfg.canWaive}
                  {@const hasBalanceLimit = isCollection && selectedResident && !!cfg?.isMandatory}
                  {@const feeLimit = getFeeLimit(code)}
                  {@const currentFeeBal = getCurrentFeeBal(code)}
                  <div class="grid gap-4 {hasBalanceLimit ? 'md:grid-cols-2' : ''}">
                    <div class="space-y-1.5">
                      <Label>{cfg.label}</Label>
                      <div class="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          bind:value={formData.fees[code]}
                          max={hasBalanceLimit && !allowOverpayment ? feeLimit : undefined}
                          disabled={!formData.accountId || isSubmitting || isEos}
                          class="text-right font-mono"
                        />
                        {#if hasBalanceLimit}
                          <Tooltip.Root>
                            <Tooltip.Trigger>
                              {#snippet child({ props })}
                                <Button
                                  variant="outline"
                                  size="icon"
                                  class="h-9 w-9 shrink-0"
                                  {...props}
                                  onclick={() => (formData.fees[code] = feeLimit.toString())}
                                  disabled={feeLimit <= 0 || isSubmitting}
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
                    {#if hasBalanceLimit}
                      <div class="space-y-1.5">
                        <Label>Remaining {cfg.shortLabel} Balance</Label>
                        <div
                          class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3"
                        >
                          {#if currentFeeBal < 0}
                            <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                          {:else}
                            <span></span>
                          {/if}
                          <div
                            class="font-mono text-sm font-bold {currentFeeBal > 0
                              ? 'text-destructive'
                              : 'text-primary'}"
                          >
                            {formatAccounting(currentFeeBal)}
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              {/each}

              {#if isCollection && selectedResident && selectedResident.email !== "_funds"}
                <div
                  class="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <Checkbox id="allowOverpayment" bind:checked={allowOverpayment} />
                  <div class="grid gap-0.5">
                    <Label for="allowOverpayment" class="cursor-pointer">Allow Overpayment</Label>
                    <p class="text-xs leading-tight text-muted-foreground">
                      Override balance validation for fees.
                    </p>
                  </div>
                </div>
              {/if}
            </div>

            {#if formData.type !== TransactionType.WAIVED && formData.type !== TransactionType.DISCREPANCY}
              <div
                class="grid gap-6 pt-2 {formData.type === TransactionType.FUND_TRANSFER
                  ? 'md:grid-cols-2'
                  : ''}"
              >
                <div class="space-y-1.5">
                  <Label
                    >{formData.type === TransactionType.FUND_TRANSFER
                      ? "Payment Processor (From)"
                      : "Payment Processor"}</Label
                  >
                  <Combobox
                    bind:value={formData.mop}
                    options={mopOptions}
                    disabled={!formData.accountId || isSubmitting}
                    class="w-full"
                  />
                </div>
                {#if formData.type === TransactionType.FUND_TRANSFER}
                  <div class="space-y-1.5">
                    <Label>Payment Processor (To)</Label>
                    <Combobox
                      bind:value={formData.mopTo}
                      options={mopOptions}
                      disabled={!formData.accountId || isSubmitting}
                      class="w-full"
                    />
                  </div>
                {/if}
              </div>
            {/if}

            {#if formData.type !== TransactionType.WAIVED && formData.type !== TransactionType.DISCREPANCY}
              <div class="grid gap-6 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label>Reference Number</Label>
                  <Input
                    bind:value={formData.mopRefNo}
                    disabled={!formData.accountId || isSubmitting}
                    placeholder="e.g., Transaction ID"
                  />
                </div>
                <div class="space-y-1.5">
                  <Label>InstaPay Invoice Number</Label>
                  <Input
                    bind:value={formData.instapayInvoice}
                    disabled={!formData.accountId || isSubmitting}
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
                <Label>Public Remarks</Label>
                <Textarea
                  bind:value={formData.notes}
                  placeholder="Description for the resident…"
                  class="h-30 text-xs"
                />
              </div>
              <div class="space-y-2">
                <Label>Private Notes</Label>
                <Textarea
                  bind:value={formData.notesPrivate}
                  placeholder="Internal context only (not visible to resident)…"
                  class="h-30 text-xs"
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t pt-4">
            <Button
              onclick={handleSubmit}
              disabled={!formData.accountId || !formData.creatorId}
              isLoading={isSubmitting}
              icon={Save}
              class="min-w-30"
            >
              Save
            </Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
