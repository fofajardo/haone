<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { LoaderCircle, ShieldCheck } from "lucide-svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { LS_KEYS } from "$lib/constants";
  import { clearResident } from "$lib/resident-logic";
  import type { ResidentRecord } from "$lib/schemas";
  import { pluralize } from "$lib/receipt-utils";
  import AccountAutocomplete from "$lib/components/AccountAutocomplete.svelte";

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
  let signatoryName = $state(auth.user?.name || "");
  let signatoryStNo = $state("");
  let signatoryTitle = $state("");
  let hasInitializedSignatory = $state(false);

  onMount(() => {
    const savedTitle = localStorage.getItem(LS_KEYS.CLEARANCE_TITLE);
    signatoryTitle = savedTitle || "Auditor";
  });

  // Re-sync signatory metadata when data becomes available
  $effect(() => {
    if (allAccounts.length > 0 && !hasInitializedSignatory) {
      const me = allAccounts.find(
        (a: ResidentRecord) => a.email.toLowerCase() === auth.user?.email?.toLowerCase()
      );
      if (me) {
        signatoryName = me.ceFullName || me.name;
        signatoryStNo = me.stno;
        hasInitializedSignatory = true;
      }
    }
  });

  $effect(() => {
    if (!signatoryName) {
      signatoryStNo = "";
    }
  });

  async function handleConfirm() {
    if (!uiSettings.accountingWorkbookId || residents.length === 0) return;

    isClearing = true;
    try {
      localStorage.setItem(LS_KEYS.CLEARANCE_TITLE, signatoryTitle);

      for (const res of residents) {
        const result = await clearResident(
          res,
          uiSettings.accountingWorkbookId,
          brandingState.selectedKey,
          signatoryName,
          signatoryTitle
        );

        // In-place update for reactivity
        res.ceRefNo = result.refNo;
        res.ceIssued = result.dateString;
        res.ceLink = result.publicLink;
      }

      open = false;
      if (onSuccess) onSuccess(residents.length);
    } catch (e: any) {
      console.error("Clearance error:", e);
      // We'll let the parent handle alerts if needed, or we could add one here
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
          ? `Review the signatory details for the Certificate of Full Payment. This will apply to ${pluralize(residents.length, "eligible resident", "eligible residents")}.`
          : "Review the signatory details for the Certificate of Full Payment. The title will be cached for future use."}
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="space-y-3">
        <AccountAutocomplete
          label="Signatory Name"
          accounts={allAccounts}
          filter={(a) => !uiSettings.currentSemester || a.period === uiSettings.currentSemester}
          useOfficialName={true}
          bind:value={signatoryName}
          onSelect={(a) => {
            signatoryName = a.ceFullName || a.name;
            signatoryStNo = a.stno;
          }}
          placeholder="Search for signatory…"
          class="w-full"
        />
        <div
          class="flex items-center justify-between rounded-lg border border-dashed border-muted bg-muted/20 p-3"
        >
          <div class="flex flex-col">
            <span class="mb-1 text-[10px] leading-none font-bold text-muted-foreground uppercase"
              >Current Selection</span
            >
            <span class="text-xs font-bold text-foreground/80"
              >{signatoryName || "None selected"}</span
            >
            {#if signatoryStNo}
              <span class="mt-0.5 font-mono text-[9px] text-muted-foreground">{signatoryStNo}</span>
            {/if}
          </div>
        </div>
      </div>
      <div class="space-y-1">
        <Label
          for="clearance-title"
          class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Title</Label
        >
        <Input id="clearance-title" bind:value={signatoryTitle} class="h-9 text-xs" />
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={handleConfirm} disabled={isClearing || !signatoryName || !signatoryTitle}>
        {#if isClearing}
          <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
          Processing…
        {:else}
          {residents.length > 1 ? "Issue Certificates" : "Issue Certificate"}
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
