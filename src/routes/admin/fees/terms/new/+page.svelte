<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { fetchConstants, addConstant } from "$api/controllers/constants-controller";
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
  let allConstants = $state<{ key: string; value: string }[]>([]);

  const termOptions = [
    { value: "1S", label: "1st Semester" },
    { value: "2S", label: "2nd Semester" },
    { value: "MY", label: "Midyear Term" }
  ];

  onMount(async () => {
    const records = await fetchConstants();
    allConstants = records.map((r) => ({ key: r.key, value: r.value }));
  });

  async function handleSave() {
    const yy = String(newStartYear).slice(-2);
    const zz = String(newStartYear + 1).slice(-2);
    const value = `${yy}${zz}_${newTerm}`;
    const key = `TERM_${value}`;
    const description = `AY 20${yy}-20${zz} ${termOptions.find((t) => t.value === newTerm)?.label}`;

    if (allConstants.some((c) => c.key === key)) {
      toast.error("This academic term already exists.");
      return;
    }

    isSaving = true;
    try {
      await addConstant(key, value, description);
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
