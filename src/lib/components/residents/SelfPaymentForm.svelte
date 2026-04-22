<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchServer } from "$lib/utils";
  import { translateMop } from "$lib/receipt-utils";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { LoaderCircle, Calendar, Wallet, Link } from "lucide-svelte";
  import { Combobox } from "$lib/components/ui/combobox";
  import { onMount } from "svelte";

  interface Props {
    isSubmitting: boolean;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
  }

  let { isSubmitting, onSave, onCancel }: Props = $props();

  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);

  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    waterFee: "0",
    assocFee: "0",
    miscFee: "0",
    mop: "GCASH",
    proofLink: ""
  });

  async function loadData() {
    try {
      const statusData = await fetchServer("/api/resident/check-status", {}, true);
      mopTypes = statusData.mopTypes || [];
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  function handleSubmit() {
    onSave({
      date: formData.date,
      waterFee: parseFloat(formData.waterFee) || 0,
      assocFee: parseFloat(formData.assocFee) || 0,
      misc: parseFloat(formData.miscFee) || 0,
      mop: formData.mop,
      proofLink: formData.proofLink
    });
  }
</script>

<Card.Root>
  <Card.Content class="space-y-6 pt-6">
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Date</Label>
        <Input type="date" bind:value={formData.date} disabled={isSubmitting} />
      </div>
      <div class="space-y-2">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Mode of Payment</Label
        >
        <Combobox
          bind:value={formData.mop}
          options={mopTypes}
          disabled={isLoading || isSubmitting}
          class="h-10 w-full"
        />
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="space-y-2">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Water Fee</Label
        >
        <Input
          type="number"
          step="0.01"
          bind:value={formData.waterFee}
          disabled={isSubmitting}
          class="text-right font-mono"
        />
      </div>
      <div class="space-y-2">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Assoc Fee</Label
        >
        <Input
          type="number"
          step="0.01"
          bind:value={formData.assocFee}
          disabled={isSubmitting}
          class="text-right font-mono"
        />
      </div>
      <div class="space-y-2">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Misc</Label>
        <Input
          type="number"
          step="0.01"
          bind:value={formData.miscFee}
          disabled={isSubmitting}
          class="text-right font-mono"
        />
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
        >Proof of Payment Link</Label
      >
      <Input
        placeholder="Drive or Image Link"
        bind:value={formData.proofLink}
        disabled={isSubmitting}
      />
    </div>

    <div class="flex justify-end gap-3 border-t pt-4">
      <Button variant="outline" onclick={onCancel} disabled={isSubmitting}>Cancel</Button>
      <Button onclick={handleSubmit} disabled={isSubmitting}>
        {#if isSubmitting}
          <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
          Submitting…
        {:else}
          Submit Payment
        {/if}
      </Button>
    </div>
  </Card.Content>
</Card.Root>
