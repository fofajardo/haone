<script lang="ts">
  import { fetchServer } from "$utils/api-client";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
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

  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  async function loadData() {
    try {
      const statusData = await fetchResidentStatus(undefined, true);
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
        <Label>Date</Label>
        <Input type="date" bind:value={formData.date} disabled={isSubmitting} />
      </div>
      <div class="space-y-2">
        <Label>Mode of Payment</Label>
        <Combobox
          bind:value={formData.mop}
          options={mopTypes}
          disabled={isLoading || isSubmitting}
          class="h-9 w-full"
        />
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="space-y-2">
        <Label>Water Fee</Label>
        <Input
          type="number"
          step="0.01"
          bind:value={formData.waterFee}
          disabled={isSubmitting}
          class="text-right font-mono"
        />
      </div>
      <div class="space-y-2">
        <Label>Assoc Fee</Label>
        <Input
          type="number"
          step="0.01"
          bind:value={formData.assocFee}
          disabled={isSubmitting}
          class="text-right font-mono"
        />
      </div>
      <div class="space-y-2">
        <Label>Misc</Label>
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
      <Label>Proof of Payment Link</Label>
      <Input
        placeholder="Drive or Image Link"
        bind:value={formData.proofLink}
        disabled={isSubmitting}
      />
    </div>

    <div class="flex justify-end gap-3 border-t pt-4">
      <Button variant="outline" onclick={onCancel} disabled={isSubmitting}>Cancel</Button>
      <Button onclick={handleSubmit} isLoading={isSubmitting}>Submit Payment</Button>
    </div>
  </Card.Content>
</Card.Root>
