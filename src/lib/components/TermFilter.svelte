<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { translatePeriod, sortPeriods } from "$lib/receipt-utils";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";

  let { value = $bindable(), onSelect } = $props<{
    value?: string;
    onSelect?: () => void;
  }>();

  // If value is not provided, we fall back to global uiSettings.currentTerm
  let activeTerm = $derived(value !== undefined ? value : uiSettings.currentTerm);

  interface TermOption {
    value: string;
    label: string;
    description: string;
  }

  let terms = $state<TermOption[]>([]);

  const termOptions = $derived(
    terms.map((t) => ({
      value: t.value,
      label: translatePeriod(t.value)
    }))
  );
  let isLoading = $state(false);

  async function loadTerms() {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    try {
      const rows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C");
      if (rows.length <= 1) return;

      const allTerms = rows
        .slice(1)
        .filter(
          (row) =>
            row[0]?.startsWith("TERM_") && row[0] !== "TERM_CURR" && row[0] !== "TERM_RESERVED"
        )
        .map((row) => ({
          value: row[1] || "",
          label: row[1] || "",
          description: row[2] || ""
        }));

      const sortedValues = sortPeriods(allTerms.map((t) => t.value));
      terms = sortedValues.map((val) => {
        const found = allTerms.find((t) => t.value === val)!;
        return {
          value: val,
          label: val,
          description: found.description
        };
      });

      if (!activeTerm && terms.length > 0) {
        if (value !== undefined) {
          value = terms[0].value;
        } else {
          uiSettings.currentTerm = terms[0].value;
        }
      }
    } catch (e) {
      console.error("Failed to load terms:", e);
    } finally {
      isLoading = false;
    }
  }

  onMount(loadTerms);

  function handleChange(val: string | undefined) {
    if (val) {
      if (value !== undefined) {
        value = val;
      } else {
        uiSettings.currentTerm = val;
      }
      onSelect?.();
    }
  }
</script>

<div class="mb-0 min-w-0 space-y-1">
  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
    >Academic Term</Label
  >
  {#if terms.length > 0}
    <Combobox
      value={activeTerm}
      options={termOptions}
      class="h-9 w-full"
      onSelect={(val) => handleChange(val)}
    />
  {:else}
    <Input
      value={activeTerm}
      placeholder="Term code…"
      class="h-9 w-full text-xs"
      onchange={(e) => handleChange(e.currentTarget.value)}
      onblur={() => onSelect?.()}
    />
  {/if}
</div>
