<script lang="ts">
  import { onMount } from "svelte";
  import { fetchTerms } from "$api/controllers/constants-controller";
  import { translatePeriod } from "$utils/translators";
  import { sortPeriods } from "$utils/sort";
  import { Combobox } from "$ui/combobox";
  import { Label } from "$ui/label";
  import { Input } from "$ui/input";
  import Skeleton from "../skeleton/skeleton.svelte";

  let { value = $bindable(), onSelect } = $props<{
    value: string;
    onSelect?: () => void;
  }>();

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
    isLoading = true;
    // TODO: These values should be cached.
    try {
      const allTerms = await fetchTerms();
      if (allTerms.length == 0) {
        return;
      }
      const sortedValues = sortPeriods(allTerms.map((t) => t.value));
      terms = sortedValues.map((val) => {
        const found = allTerms.find((t) => t.value === val)!;
        return {
          value: val,
          label: val,
          description: found.description
        };
      });
    } catch (e) {
      console.error("Failed to load terms:", e);
    } finally {
      isLoading = false;
    }
  }

  onMount(loadTerms);

  function handleChange(val: string | undefined) {
    if (val) {
      value = val;
      onSelect?.();
    }
  }
</script>

<div class="mb-0 min-w-0 space-y-1">
  <Label>Academic Term</Label>
  {#if terms.length > 0}
    <Combobox
      {value}
      options={termOptions}
      class="h-9 w-full"
      onSelect={(val) => handleChange(val)}
    />
  {:else if isLoading}
    <Skeleton class="h-9 w-full" />
  {:else}
    <Input
      {value}
      placeholder="Term code…"
      class="h-9 w-full text-xs"
      onchange={(e) => handleChange(e.currentTarget.value)}
      onblur={() => onSelect?.()}
    />
  {/if}
</div>
