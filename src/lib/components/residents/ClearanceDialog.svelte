<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { auth } from "$state/auth.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { clearResident } from "$api/controllers/resident-controller";
  import type { ResidentRecord } from "$lib/types";
  import { pluralize } from "$utils/formatters";
  import { X, ShieldCheck } from "@lucide/svelte";

  let {
    open = $bindable(false),
    residents = [],
    allAccounts = [],
    onSuccess
  } = $props<{
    open: boolean;
    residents: ResidentRecord[];
    allAccounts: ResidentRecord[];
    onSuccess?: (count: number) => void;
  }>();

  let isClearing = $state(false);

  async function handleConfirm() {
    if (residents.length === 0) {
      return;
    }

    isClearing = true;
    try {
      const issuer = allAccounts.find(
        (a: ResidentRecord) => a.email.toLowerCase() === auth.user?.email?.toLowerCase()
      );
      const issuerId = issuer?.residentId || "";

      for (const res of residents) {
        const result = await clearResident(res, issuerId);

        // In-place update for reactivity
        res.ceRefNo = result.refNo;
        res.ceIssued = result.dateString;
        res.ceLink = result.publicLink;
      }

      open = false;
      if (onSuccess) onSuccess(residents.length);
    } catch (e: any) {
      console.error("Clearance error:", e);
    } finally {
      isClearing = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>
        {residents.length > 1 ? "Batch Clearance Certification" : "Clearance Certification"}
      </Dialog.Title>
      <Dialog.Description>
        {residents.length > 1
          ? `Issue Certificate of Full Payment for ${pluralize(residents.length, "eligible resident", "eligible residents")}. Signatory details will be resolved automatically based on your active position.`
          : "Issue Certificate of Full Payment. Signatory details will be resolved automatically based on your active position."}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => (open = false)} icon={X}>Cancel</Button>
      <Button
        onclick={handleConfirm}
        isLoading={isClearing}
        disabled={isClearing}
        icon={ShieldCheck}
      >
        {residents.length > 1 ? "Issue Certificates" : "Issue Certificate"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
