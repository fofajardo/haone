<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    fetchConstants,
    addConstant,
    updateConstant
  } from "$api/controllers/constants-controller";
  import { feeCodesState } from "$state/fee-codes.svelte";
  import { translatePeriod } from "$utils/translators";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Calculator, Save } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const term = $derived(page.params.term ?? "");
  const termLabel = $derived(translatePeriod(term) || term);
  const mandatoryFees = $derived(feeCodesState.list.filter((c) => c.isMandatory));

  let allConstants = $state<{ key: string; value: string; rowIndex: number }[]>([]);
  let regularValues = $state<Record<string, number>>({});
  let cpValues = $state<Record<string, number>>({});
  let isLoading = $state(true);
  let isSaving = $state(false);
  let errorMessage = $state("");

  const totalRegular = $derived(
    mandatoryFees.reduce((sum, cfg) => sum + (Number(regularValues[cfg.id]) || 0), 0)
  );

  async function loadData(bypassCache = false) {
    isLoading = true;
    errorMessage = "";
    try {
      const [records] = await Promise.all([
        fetchConstants(bypassCache),
        feeCodesState.load(bypassCache)
      ]);
      allConstants = records.map((r, idx) => ({
        key: r.key,
        value: r.value,
        rowIndex: idx
      }));

      const getVal = (suffix: string) => {
        const key = `FEES_${term}_${suffix}`;
        const found = allConstants.find((c) => c.key === key);
        return found ? parseFloat(found.value) || 0 : 0;
      };

      const nextReg: Record<string, number> = {};
      const nextCp: Record<string, number> = {};
      for (const cfg of feeCodesState.list.filter((c) => c.isMandatory)) {
        const suffix = cfg.shortLabel.toUpperCase();
        nextReg[cfg.id] = getVal(suffix);
        nextCp[cfg.id] = getVal(`${suffix}_CP`);
      }
      regularValues = nextReg;
      cpValues = nextCp;
    } catch (e: any) {
      errorMessage = e?.message || "Failed to load term fees.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => loadData());

  async function handleSave() {
    isSaving = true;
    try {
      const updates: { suffix: string; val: number }[] = [];
      for (const cfg of mandatoryFees) {
        const suffix = cfg.shortLabel.toUpperCase();
        updates.push({ suffix, val: Number(regularValues[cfg.id]) || 0 });
        updates.push({ suffix: `${suffix}_CP`, val: Number(cpValues[cfg.id]) || 0 });
      }
      updates.push({ suffix: "TOTAL", val: totalRegular });

      for (const item of updates) {
        const key = `FEES_${term}_${item.suffix}`;
        const existing = allConstants.find((c) => c.key === key);
        if (existing) {
          await updateConstant(key, String(item.val), `${termLabel} ${item.suffix}`);
        } else {
          await addConstant(key, String(item.val), `${termLabel} ${item.suffix}`);
        }
      }

      toast.success("Term fees updated.");
      await loadData(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save term fees.");
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Customize Fees"
    subtitle={termLabel}
    onBack={() => goto("/admin/fees/terms")}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[
      {
        label: isSaving ? "Saving..." : "Save",
        icon: Save,
        disabled: isSaving || isLoading,
        onclick: handleSave
      }
    ]}
  />

  {#if isLoading}
    <LoadingView />
  {:else if errorMessage}
    <ErrorView error={errorMessage}>
      <Button variant="outline" size="sm" onclick={() => loadData(true)}>Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-4 md:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">Fees</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          {#each mandatoryFees as cfg (cfg.id)}
            <div class="space-y-1.5">
              <Label for="reg-{cfg.id}">{cfg.label}</Label>
              <Input
                id="reg-{cfg.id}"
                type="number"
                step="0.01"
                bind:value={regularValues[cfg.id]}
                disabled={isSaving}
              />
            </div>
          {/each}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">Collection Periods (Times per Term)</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          {#each mandatoryFees as cfg (cfg.id)}
            <div class="space-y-1.5">
              <Label for="cp-{cfg.id}">{cfg.label}</Label>
              <Input
                id="cp-{cfg.id}"
                type="number"
                bind:value={cpValues[cfg.id]}
                disabled={isSaving}
              />
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
    </div>

    <Card.Root>
      <Card.Content class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-muted-foreground">
          <Calculator class="h-4 w-4" />
          <span class="text-xs font-medium tracking-wider uppercase">Total Fee</span>
        </div>
        <span class="text-xl font-black text-foreground">
          ₱{totalRegular.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </Card.Content>
    </Card.Root>
  {/if}
</div>
