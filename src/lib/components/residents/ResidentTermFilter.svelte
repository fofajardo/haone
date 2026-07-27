<script lang="ts">
  import { onMount } from "svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchServer } from "$utils/api-client";
  import { translatePeriod } from "$utils/translators";
  import { Combobox } from "$ui/combobox";
  import { Label } from "$ui/label";
  import { Input } from "$ui/input";

  let {
    value = $bindable(),
    onSelect,
    options = null
  } = $props<{
    value?: string;
    onSelect?: () => void;
    options?: string[] | null;
  }>();

  // If value is not provided, we fall back to global uiSettings.currentTerm
  let activeTerm = $derived(value !== undefined ? value : uiSettings.currentTerm);

  let internalTerms = $state<string[]>([]);
  let isLoading = $state(false);

  const termOptions = $derived.by(() => {
    const list = options || internalTerms;
    return list.map((t: string) => ({
      value: t,
      label: translatePeriod(t)
    }));
  });

  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  async function loadTerms() {
    if (options && options.length > 0) return;
    isLoading = true;
    try {
      const statusData = await fetchResidentStatus(undefined, true);
      if (statusData.allTerms) {
        internalTerms = statusData.allTerms;

        if (!activeTerm && internalTerms.length > 0) {
          const defaultTerm = statusData.systemActiveTerm || internalTerms[0];
          if (value !== undefined) {
            value = defaultTerm;
          } else {
            uiSettings.currentTerm = defaultTerm;
          }
        }
      }
    } catch (e) {
      console.error("Failed to load resident terms:", e);
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
  <Label>Academic Term</Label>
  {#if termOptions.length > 0}
    <Combobox
      value={activeTerm}
      options={termOptions}
      class="h-9 w-full"
      onSelect={(val) => handleChange(val)}
      disabled={isLoading}
    />
  {:else}
    <Input
      value={activeTerm}
      placeholder="Term code…"
      class="h-9 w-full text-xs"
      onchange={(e) => handleChange(e.currentTarget.value)}
      onblur={() => onSelect?.()}
      disabled={isLoading}
    />
  {/if}
</div>
