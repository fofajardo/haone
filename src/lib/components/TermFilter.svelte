<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { translatePeriod } from "$lib/receipt-utils";
  import * as Select from "$lib/components/ui/select";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";

  let { onSelect } = $props<{ onSelect?: () => void }>();

  interface SemesterOption {
    value: string;
    label: string;
    description: string;
  }

  let semesters = $state<SemesterOption[]>([]);
  let isLoading = $state(false);

  async function loadSemesters() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "constants!A:C");
      if (rows.length <= 1) return;

      const allSemesters = rows
        .slice(1)
        .filter((row) => row[0]?.startsWith("SEM_"))
        .filter((row) => !row[1]?.includes("DO_NOT_USE") && !row[2]?.includes("DO_NOT_USE"))
        .map((row) => ({
          value: row[1] || "",
          label: row[1] || "",
          description: row[2] || ""
        }));

      semesters = allSemesters.filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i);

      if (!uiSettings.currentSemester && semesters.length > 0) {
        uiSettings.currentSemester = semesters[semesters.length - 1].value;
      }
    } catch (e) {
      console.error("Failed to load semesters:", e);
    } finally {
      isLoading = false;
    }
  }

  onMount(loadSemesters);

  function handleChange(val: string | undefined) {
    if (val) {
      uiSettings.currentSemester = val;
      onSelect?.();
    }
  }
</script>

<div class="space-y-1 mb-0 min-w-0">
  <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
    >Academic Term</Label
  >
  {#if semesters.length > 0}
    <Select.Root type="single" value={uiSettings.currentSemester} onValueChange={handleChange}>
      <Select.Trigger class="h-9 w-full min-w-0 text-xs font-semibold">
        <span class="truncate">
          {translatePeriod(uiSettings.currentSemester) || "Select Term"}
        </span>
      </Select.Trigger>
      <Select.Content>
        {#each semesters as sem}
          <Select.Item value={sem.value} label={translatePeriod(sem.value)}>
            {translatePeriod(sem.value)}
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  {:else}
    <Input
      bind:value={uiSettings.currentSemester}
      placeholder="Term code..."
      class="h-9 w-full text-xs"
      onblur={() => onSelect?.()}
    />
  {/if}
</div>
