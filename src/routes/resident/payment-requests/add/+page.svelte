<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";

  import { addPaymentRequest } from "$lib/shared-records-logic";
  import { fetchServer } from "$lib/utils";
  import { formatCurrency, formatAccounting } from "$lib/receipt-utils";
  import type { ResidentRecord } from "$lib/schemas";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Calendar, Wallet, Link, ArrowLeftToLine, TriangleAlert } from "lucide-svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Badge } from "$lib/components/ui/badge";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let resident = $state<ResidentRecord | null>(null);
  let mopTypes = $state<{ value: string; label: string }[]>([]);

  let formData = $state({
    date: new Date().toISOString().split("T")[0],
    waterFee: "0",
    assocFee: "0",
    miscFee: "0",
    mop: "GCASH",
    proofLink: "",
    notes: ""
  });

  const waterLimit = $derived(resident?.waterBal || 0);
  const assocLimit = $derived(resident?.assocBal || 0);

  const currentWaterBal = $derived.by(() => {
    if (!resident) return 0;
    return waterLimit - (Number(formData.waterFee) || 0);
  });

  const currentAssocBal = $derived.by(() => {
    if (!resident) return 0;
    return assocLimit - (Number(formData.assocFee) || 0);
  });

  async function loadData() {
    if (!auth.user?.email) return;
    isLoading = true;
    try {
      const statusData = await fetchServer("/api/resident/check-status");
      resident = statusData.account;
      mopTypes = statusData.mopTypes;
    } catch (e: any) {
      toast.error("Failed to load account data");
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  async function handleSubmit() {
    if (!resident) return;

    const water = parseFloat(formData.waterFee) || 0;
    const assoc = parseFloat(formData.assocFee) || 0;
    const misc = parseFloat(formData.miscFee) || 0;

    if (water === 0 && assoc === 0 && misc === 0) {
      toast.error("Please enter at least one fee amount");
      return;
    }

    if (!formData.proofLink.trim()) {
      toast.error("Proof of payment link is required");
      return;
    }

    try {
      new URL(formData.proofLink);
    } catch (e) {
      toast.error("Invalid proof of payment link. Please provide a valid URL.");
      return;
    }

    isSubmitting = true;
    try {
      await addPaymentRequest({
        id: crypto.randomUUID(),
        residentId: resident!.residentId,
        date: formData.date,
        waterFee: water,
        assocFee: assoc,
        misc: misc,
        mop: formData.mop,
        type: "COLLECTION",
        proofLink: formData.proofLink,
        status: "PENDING",
        notes: formData.notes
      });
      toast.success("Payment submitted successfully");
      goto("/resident/payment-requests");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="New Payment Request" />
  <div class="mx-auto max-w-3xl space-y-6">
    {#if isLoading}
      <LoadingView />
    {:else if !resident}
      <Card.Root class="border-destructive/20 bg-destructive/5 text-destructive">
        <Card.Content class="py-10 text-center">
          <p class="font-bold">Account Record Not Found</p>
          <p class="text-sm">
            We couldn't locate your resident record. Please contact the administrator.
          </p>
        </Card.Content>
      </Card.Root>
    {:else}
      <Card.Root>
        <Card.Content class="space-y-8 pt-6">
          <!-- General Info Section -->
          <div class="space-y-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Calendar class="h-3.5 w-3.5" /> General Information
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Transaction Date</Label
                >
                <Input type="date" bind:value={formData.date} disabled={isSubmitting} />
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Payment Method</Label
                >
                <Combobox
                  bind:value={formData.mop}
                  options={mopTypes}
                  disabled={isSubmitting}
                  class="h-10 w-full"
                />
              </div>
            </div>
          </div>

          <!-- Payment Details Section -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Wallet class="h-3.5 w-3.5" /> Payment Details
            </Label>

            <div class="space-y-6">
              <!-- Water Fee Row -->
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Water Fee</Label
                  >
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.waterFee}
                      disabled={isSubmitting}
                      class="text-right font-mono"
                    />
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button
                            variant="outline"
                            size="icon"
                            class="h-9 w-9 shrink-0"
                            {...props}
                            onclick={() => (formData.waterFee = waterLimit.toString())}
                            disabled={waterLimit <= 0 || isSubmitting}
                            icon={ArrowLeftToLine}
                          />
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p class="text-xs font-bold">Pay remaining water balance</p>
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >New Water Balance</Label
                  >
                  <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                    {#if currentWaterBal < 0}
                      <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                    {:else}
                      <span></span>
                    {/if}
                    <div
                      class="font-mono text-sm font-bold {currentWaterBal > 0
                        ? 'text-destructive'
                        : 'text-primary'}"
                    >
                      {formatAccounting(currentWaterBal)}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Association Fee Row -->
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >Association Fee</Label
                  >
                  <div class="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      bind:value={formData.assocFee}
                      disabled={isSubmitting}
                      class="text-right font-mono"
                    />
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        {#snippet child({ props })}
                          <Button
                            variant="outline"
                            size="icon"
                            class="h-9 w-9 shrink-0"
                            {...props}
                            onclick={() => (formData.assocFee = assocLimit.toString())}
                            disabled={assocLimit <= 0 || isSubmitting}
                            icon={ArrowLeftToLine}
                          />
                        {/snippet}
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p class="text-xs font-bold">Pay remaining assoc balance</p>
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >New Association Balance</Label
                  >
                  <div class="flex h-9 items-center justify-between rounded-md bg-muted/20 px-3">
                    {#if currentAssocBal < 0}
                      <Badge variant="destructive" class="font-bold">OVERPAID</Badge>
                    {:else}
                      <span></span>
                    {/if}
                    <div
                      class="font-mono text-sm font-bold {currentAssocBal > 0
                        ? 'text-destructive'
                        : 'text-primary'}"
                    >
                      {formatAccounting(currentAssocBal)}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Misc Fee Row -->
              <div class="space-y-1.5">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Misc / Other Payments</Label
                >
                <Input
                  type="number"
                  step="0.01"
                  bind:value={formData.miscFee}
                  disabled={isSubmitting}
                  class="text-right font-mono"
                />
              </div>
            </div>
          </div>

          <!-- Proof & Notes Section -->
          <div class="space-y-4 border-t pt-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Link class="h-3.5 w-3.5" /> Verification
            </Label>
            <div class="space-y-4">
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Proof of Payment Link</Label
                >
                <Input
                  placeholder="Drive or Image Link"
                  bind:value={formData.proofLink}
                  disabled={isSubmitting}
                />
                <p class="text-xs text-muted-foreground">
                  Upload your screenshot to Google Drive or any image host and paste the link here.
                </p>
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                  >Remarks</Label
                >
                <Input
                  placeholder="Optional notes about this payment…"
                  bind:value={formData.notes}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <!-- Summary Section -->
          <div class="space-y-4">
            <div
              class="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-500"
            >
              <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
              <p class="text-xs leading-relaxed font-medium">
                Once submitted, this request cannot be modified. If you make a mistake, please
                create a new request and cancel the previous one.
              </p>
            </div>

            <div class="rounded-xl border border-brand/10 bg-brand/5 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs font-bold tracking-widest text-brand uppercase">Total Amount</p>
                  <p class="text-3xl font-black text-brand tabular-nums">
                    {formatCurrency(
                      (parseFloat(formData.waterFee) || 0) +
                        (parseFloat(formData.assocFee) || 0) +
                        (parseFloat(formData.miscFee) || 0)
                    )}
                  </p>
                </div>
                <Button size="lg" class="px-8" onclick={handleSubmit} isLoading={isSubmitting}>
                  Submit Payment
                </Button>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
</div>
