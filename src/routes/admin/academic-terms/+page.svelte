<script lang="ts">
  import { onMount } from "svelte";
  import { uiSettings } from "$state/settings.svelte";
  import {
    fetchConstants,
    addConstant,
    updateConstant
  } from "$api/controllers/constants-controller";
  import { translatePeriod } from "$utils/translators";
  import { sortPeriods } from "$utils/sort";
  import { Button } from "$ui/button";
  import * as Dialog from "$ui/dialog";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Plus, GraduationCap, Coins, Save, Calculator, CircleCheck } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import * as AlertDialog from "$ui/alert-dialog";
  import { Badge } from "$ui/badge";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import EmptyView from "$components/EmptyView.svelte";

  let terms = $state<{ value: string; description: string }[]>([]);
  let allConstants = $state<{ key: string; value: string; rowIndex: number }[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let showAddDialog = $state(false);
  let errorMessage = $state("");
  let activeTermCode = $state("");
  let confirmActiveCode = $state("");

  let newStartYear = $state(new Date().getFullYear());
  let newTerm = $state("1S");

  // Fee Editing State
  let editingFeesFor = $state<{ value: string; label: string } | null>(null);
  let feeData = $state({
    assoc: 0,
    water: 0,
    total: 0,
    assoc_cp: 0,
    water_cp: 0
  });

  const termOptions = [
    { value: "1S", label: "1st Semester" },
    { value: "2S", label: "2nd Semester" },
    { value: "MY", label: "Midyear Term" }
  ];

  async function loadTerms(bypassCache = false) {
    isLoading = true;
    errorMessage = "";
    try {
      const records = await fetchConstants(bypassCache);
      allConstants = records.map((r, idx) => ({
        key: r.key,
        value: r.value,
        rowIndex: idx
      }));

      const filtered = records
        .filter(
          (r) => r.key.startsWith("TERM_") && r.key !== "TERM_CURR" && r.key !== "TERM_RESERVED"
        )
        .map((r) => ({
          value: r.value,
          description: r.description
        }));

      const sortedValues = sortPeriods(filtered.map((t) => t.value));

      terms = sortedValues.map((val) => {
        const found = filtered.find((f) => f.value === val);
        return {
          value: val,
          description: found?.description || ""
        };
      });

      activeTermCode = allConstants.find((c) => c.key === "TERM_CURR")?.value || "";
    } catch (e) {
      console.error("Load failed", e);
      errorMessage = "Failed to load academic terms.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => loadTerms());

  async function handleAdd() {
    errorMessage = "";
    const yy = String(newStartYear).slice(-2);
    const zz = String(newStartYear + 1).slice(-2);
    const value = `${yy}${zz}_${newTerm}`;
    const key = `TERM_${value}`;
    const description = `AY 20${yy}-20${zz} ${termOptions.find((t) => t.value === newTerm)?.label}`;

    // Check if exists
    if (terms.some((s) => s.value === value) || allConstants.some((c) => c.key === key)) {
      errorMessage = "This academic term already exists.";
      return;
    }

    isSaving = true;
    try {
      await addConstant(key, value, description);
      showAddDialog = false;
      await loadTerms();
    } catch (e) {
      errorMessage = "Failed to append to constants. Please try again.";
      console.error(e);
    } finally {
      isSaving = false;
    }
  }

  function openFees(term: { value: string; label: string }) {
    editingFeesFor = term;
    const p = term.value;

    const getVal = (suffix: string) => {
      const key = `FEES_${p}_${suffix}`;
      const found = allConstants.find((c) => c.key === key);
      return found ? parseFloat(found.value) || 0 : 0;
    };

    feeData = {
      assoc: getVal("ASSOC"),
      water: getVal("WATER"),
      total: getVal("TOTAL"),
      assoc_cp: getVal("ASSOC_CP"),
      water_cp: getVal("WATER_CP")
    };
  }

  // Reactive total calculation
  $effect(() => {
    feeData.total = (feeData.assoc || 0) + (feeData.water || 0);
  });

  async function saveFees() {
    if (!editingFeesFor) {
      return;
    }
    isSaving = true;
    errorMessage = "";

    const p = editingFeesFor.value;
    const updates = [
      { suffix: "ASSOC", val: feeData.assoc },
      { suffix: "WATER", val: feeData.water },
      { suffix: "TOTAL", val: feeData.total },
      { suffix: "ASSOC_CP", val: feeData.assoc_cp },
      { suffix: "WATER_CP", val: feeData.water_cp }
    ];

    try {
      for (const u of updates) {
        const key = `FEES_${p}_${u.suffix}`;
        const existing = allConstants.find((c) => c.key === key);
        if (existing) {
          await updateConstant(key, String(u.val));
        } else {
          await addConstant(key, String(u.val), `Fee for ${p} (${u.suffix})`);
        }
      }

      editingFeesFor = null;
      await loadTerms();
    } catch (e) {
      console.error(e);
      errorMessage = "Failed to save fees.";
    } finally {
      isSaving = false;
    }
  }

  async function setActive(value: string) {
    const currConstant = allConstants.find((c) => c.key === "TERM_CURR");
    isSaving = true;
    errorMessage = "";

    try {
      if (currConstant) {
        await updateConstant("TERM_CURR", value);
      } else {
        await addConstant("TERM_CURR", value, "Current Active Term");
      }
      uiSettings.currentTerm = value;
      await loadTerms();
    } catch (e) {
      console.error(e);
      errorMessage = "Failed to update active semester.";
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <SubpageHeader
    title="Academic Terms"
    isTopLevel={true}
    onRefresh={() => loadTerms(true)}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <Button size="sm" onclick={() => (showAddDialog = true)} icon={Plus}>Add</Button>
    {/snippet}
  </SubpageHeader>

  <div class="space-y-4">
    {#if isLoading}
      <LoadingView />
    {:else if errorMessage && terms.length === 0}
      <ErrorView error={errorMessage} />
    {:else if terms.length === 0}
      <EmptyView title="No terms defined." description="Add an academic term to get started.">
        {#snippet icon()}
          <GraduationCap class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {:else}
      <div class="space-y-3">
        {#each terms as term}
          <div
            class="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:bg-muted/50"
          >
            <div class="rounded-lg bg-brand/10 p-2 text-brand">
              <GraduationCap class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3">
                <p class="text-base font-bold text-foreground">
                  {translatePeriod(term.value)}
                </p>
                {#if activeTermCode === term.value}
                  <Badge
                    variant="outline"
                    class="gap-1 border-emerald-500/20 bg-emerald-500/10 text-xs font-bold text-emerald-600 uppercase"
                  >
                    <CircleCheck class="h-3 w-3" />
                    Active
                  </Badge>
                {/if}
              </div>
            </div>

            <div class="flex items-center gap-1">
              {#if activeTermCode !== term.value}
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 gap-2 text-xs font-bold tracking-wider uppercase"
                  onclick={() => (confirmActiveCode = term.value)}
                  disabled={isSaving}
                >
                  Set Active
                </Button>
              {/if}
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 rounded-lg"
                onclick={() => openFees({ value: term.value, label: translatePeriod(term.value) })}
                title="Edit Fees"
                icon={Coins}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Add Term Dialog -->
<Dialog.Root bind:open={showAddDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add New Academic Term</Dialog.Title>
      <Dialog.Description>
        This will create a new semester code and append it to the constants sheet.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 pb-4">
      {#if errorMessage}
        <div class="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {errorMessage}
        </div>
      {/if}

      <div class="space-y-2">
        <Label for="startYear">Academic Year Start</Label>
        <div class="flex items-center gap-3">
          <Input
            id="startYear"
            type="number"
            bind:value={newStartYear}
            min="2020"
            max="2100"
            class="flex-1"
          />
          <span class="text-sm text-muted-foreground">to {newStartYear + 1}</span>
        </div>
      </div>

      <div class="space-y-2">
        <Label>Term Type</Label>
        <Combobox bind:value={newTerm} options={termOptions} class="w-full" />
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (showAddDialog = false)} disabled={isSaving}
        >Cancel</Button
      >
      <Button onclick={handleAdd} isLoading={isSaving} icon={Plus}>Create</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Edit Fees Dialog -->
<Dialog.Root
  open={!!editingFeesFor}
  onOpenChange={(o) => {
    if (!o) editingFeesFor = null;
  }}
>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Customize Fees</Dialog.Title>
      <Dialog.Description>
        Configure association and water fees for <strong>{editingFeesFor?.label}</strong>.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-6 py-4">
      {#if errorMessage}
        <div class="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
          {errorMessage}
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>Association Fee</Label>
          <Input type="number" bind:value={feeData.assoc} step="0.01" />
        </div>
        <div class="space-y-2">
          <Label>Water Fee</Label>
          <Input type="number" bind:value={feeData.water} step="0.01" />
        </div>
      </div>

      <div class="rounded-xl border bg-muted/30 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-muted-foreground">
            <Calculator class="h-4 w-4" />
            <span class="text-xs font-medium tracking-wider uppercase">Total Fee</span>
          </div>
          <span class="text-xl font-black text-foreground"
            >₱{feeData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span
          >
        </div>
      </div>

      <div class="h-px bg-border/50"></div>

      <div class="space-y-4">
        <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >Collection Periods (Times per Term)</Label
        >
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label class="text-xs">Association Fee</Label>
            <Input type="number" bind:value={feeData.assoc_cp} />
          </div>
          <div class="space-y-2">
            <Label class="text-xs">Water Fee</Label>
            <Input type="number" bind:value={feeData.water_cp} />
          </div>
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (editingFeesFor = null)} disabled={isSaving}
        >Cancel</Button
      >
      <Button onclick={saveFees} isLoading={isSaving} icon={Save}>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
  open={!!confirmActiveCode}
  onOpenChange={(o) => {
    if (!o) confirmActiveCode = "";
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Change Active Term?</AlertDialog.Title>
      <AlertDialog.Description>
        This will set <strong>{translatePeriod(confirmActiveCode)}</strong> as the primary academic term
        hall-wide. This affects balance calculations and default filters.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={() => {
          const val = confirmActiveCode;
          confirmActiveCode = "";
          setActive(val);
        }}
      >
        Confirm Change
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
