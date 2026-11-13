<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { feeCodesState } from "$state/fee-codes.svelte";
  import { globalDialog } from "$state/dialog.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Checkbox } from "$ui/checkbox";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Save, Trash2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";

  const id = $derived(page.params.id ?? "");
  const isNew = $derived(id === "new");

  let isLoading = $state(true);
  let isSaving = $state(false);

  let form = $state<{
    id?: string;
    label: string;
    shortLabel: string;
    color: string;
    canWaive: boolean;
    isMandatory: boolean;
    sortOrder: number;
  }>({
    label: "",
    shortLabel: "",
    color: "#3b82f6",
    canWaive: false,
    isMandatory: false,
    sortOrder: 0
  });

  onMount(async () => {
    isLoading = true;
    try {
      await feeCodesState.load();
      if (isNew) {
        form = {
          label: "",
          shortLabel: "",
          color: "#3b82f6",
          canWaive: false,
          isMandatory: false,
          sortOrder: feeCodesState.list.length
        };
      } else {
        const existing = feeCodesState.list.find((c) => c.id === id);
        if (!existing) {
          toast.error("Fee code not found.");
          goto("/admin/fees");
          return;
        }
        form = { ...existing };
      }
    } finally {
      isLoading = false;
    }
  });

  async function handleSave() {
    if (!form.label.trim() || !form.shortLabel.trim()) {
      toast.error("Label and short label are required.");
      return;
    }

    isSaving = true;
    try {
      await feeCodesState.upsert({
        ...form,
        label: form.label.trim(),
        shortLabel: form.shortLabel.trim()
      });
      toast.success(isNew ? "Fee code created." : "Fee code updated.");
      goto("/admin/fees");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save fee code.");
    } finally {
      isSaving = false;
    }
  }

  function handleDelete() {
    if (!form.id) {
      return;
    }
    const targetId = form.id;
    globalDialog.confirm(
      "Delete Fee Code",
      `Are you sure you want to delete "${form.label}"?`,
      async () => {
        try {
          await feeCodesState.remove(targetId);
          toast.success("Fee code deleted.");
          goto("/admin/fees");
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete fee code.");
        }
      }
    );
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title={isNew ? "Add Fee Code" : "Edit Fee Code"}
    onBack={() => goto("/admin/fees")}
    actions={[
      ...(!isNew
        ? [
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive" as const,
              disabled: isSaving || isLoading,
              onclick: handleDelete
            }
          ]
        : []),
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
  {:else}
    <Card.Root>
      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <Label for="fc-label">Label</Label>
          <Input
            id="fc-label"
            placeholder="e.g., Water Fee"
            bind:value={form.label}
            disabled={isSaving}
          />
        </div>

        <div class="space-y-2">
          <Label for="fc-short">Short Label</Label>
          <Input
            id="fc-short"
            placeholder="e.g., Water"
            bind:value={form.shortLabel}
            disabled={isSaving}
          />
        </div>

        <div class="space-y-2">
          <Label for="fc-color">Color</Label>
          <div class="flex items-center gap-2">
            <Input
              id="fc-color"
              type="color"
              class="h-9 w-12 p-1"
              bind:value={form.color}
              disabled={isSaving}
            />
            <Input bind:value={form.color} disabled={isSaving} class="font-mono text-xs" />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="fc-order">Sort Order</Label>
          <Input id="fc-order" type="number" bind:value={form.sortOrder} disabled={isSaving} />
        </div>

        <div class="flex items-center gap-6 pt-2">
          <div class="flex items-center gap-2">
            <Checkbox id="fc-waive" bind:checked={form.canWaive} disabled={isSaving} />
            <Label for="fc-waive">Can be waived</Label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox id="fc-mandatory" bind:checked={form.isMandatory} disabled={isSaving} />
            <Label for="fc-mandatory">Mandatory</Label>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>
