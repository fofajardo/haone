<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { termService, type TermRecord } from "$api/services/term-service";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import * as Card from "$ui/card";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import * as Select from "$ui/select";
  import { Save } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  let newStartYear = $state(new Date().getFullYear());
  let newTerm = $state("1S");
  let isSaving = $state(false);
  let existingTerms = $state<TermRecord[]>([]);

  const termOptions = [
    { value: "1S", label: "First Semester" },
    { value: "2S", label: "Second Semester" },
    { value: "MY", label: "Mid-Year Term" }
  ];

  onMount(async () => {
    existingTerms = await termService.getTerms();
  });

  async function handleSave() {
    const ay = `${newStartYear}-${newStartYear + 1}`;
    const termName =
      newTerm === "MY"
        ? `Mid-Year Term ${newStartYear + 1}`
        : termOptions.find((t) => t.value === newTerm)?.label || "First Semester";

    if (existingTerms.some((t) => t.ay === ay && t.term === termName)) {
      toast.error("This academic term already exists.");
      return;
    }

    const nextTermId = existingTerms.reduce((max, t) => Math.max(max, t.termId), 1000) + 1;

    isSaving = true;
    try {
      await termService.upsertTerm({
        termId: nextTermId,
        term: termName,
        ay,
        termType: "Semestral",
        startDate: null,
        endDate: null,
        isActive: false
      });
      toast.success("Academic term added.");
      goto("/admin/fees/terms");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add academic term.");
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Add Term"
    onBack={() => goto("/admin/fees/terms")}
    actions={[
      {
        label: isSaving ? "Saving..." : "Save",
        icon: Save,
        disabled: isSaving,
        onclick: handleSave
      }
    ]}
  />

  <Card.Root>
    <Card.Content class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <Label for="term-year">Start Year</Label>
        <Input id="term-year" type="number" bind:value={newStartYear} disabled={isSaving} />
      </div>
      <div class="space-y-2">
        <Label for="term-sem">Semester</Label>
        <Select.Root type="single" bind:value={newTerm} disabled={isSaving}>
          <Select.Trigger id="term-sem" class="w-full">
            {termOptions.find((t) => t.value === newTerm)?.label || "Select semester"}
          </Select.Trigger>
          <Select.Content>
            {#each termOptions as opt}
              <Select.Item value={opt.value}>{opt.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </Card.Content>
  </Card.Root>
</div>
