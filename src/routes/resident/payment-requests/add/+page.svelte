<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { uiSettings } from "$state/settings.svelte";

  import { addPaymentRequest } from "$api/controllers/payment-request-controller";
  import { fetchServer } from "$utils/api-client";
  import { compressImage, deleteUploadedImage } from "$utils/image-utils";
  import { formatCurrency, formatAccounting } from "$utils/formatters";
  import type { ResidentRecord } from "$lib/types";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import * as Card from "$ui/card";
  import { Combobox } from "$ui/combobox";
  import {
    Calendar,
    Wallet,
    Link,
    ArrowLeftToLine,
    TriangleAlert,
    Upload,
    ImageIcon,
    Trash2,
    HandCoins
  } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import * as Tooltip from "$ui/tooltip";
  import { Badge } from "$ui/badge";
  import ContentHeader from "$components/ContentHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let resident = $state<ResidentRecord | null>(null);
  let mopTypes = $state<{ value: string; label: string }[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();
  let isUploading = $state(false);
  let pendingFile = $state<File | Blob | null>(null);
  let previewUrl = $state<string | null>(null);

  async function handleFileUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      isUploading = true;
      try {
        const processedFile = await compressImage(file);
        pendingFile = processedFile;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(processedFile);
        formData.proofLink = "PENDING_UPLOAD"; // Marker to show preview
      } catch (err: any) {
        console.error(err);
        toast.error("File processing failed: " + err.message);
      } finally {
        isUploading = false;
      }
    }
  }

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

  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  async function loadData() {
    if (!auth.googleUser?.email) {
      return;
    }
    isLoading = true;
    error = null;
    try {
      const statusData = await fetchResidentStatus();
      resident = statusData.account;
      mopTypes = statusData.mopTypes;
      if (!resident) {
        return;
      }
    } catch (e: any) {
      error = e.message || "Failed to load account data";
    } finally {
      isLoading = false;
    }
  }

  function handleRemoveImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    pendingFile = null;
    previewUrl = null;
    formData.proofLink = "";
  }

  onMount(() => {
    pageState.title = "Add Payment Request";
    loadData();
  });

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
      if (formData.proofLink !== "PENDING_UPLOAD") {
        new URL(formData.proofLink);
      }
    } catch (e) {
      toast.error("Invalid proof of payment link. Please provide a valid URL.");
      return;
    }

    isSubmitting = true;
    try {
      let finalProofLink = formData.proofLink;

      if (pendingFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", pendingFile, "payment_proof.jpg");
        const data = await fetchServer("/api/upload?type=payments", {
          method: "POST",
          body: formDataUpload
        });
        finalProofLink = data.url;
      }

      await addPaymentRequest({
        id: crypto.randomUUID(),
        residentId: resident!.residentId,
        date: formData.date,
        waterFee: water,
        assocFee: assoc,
        misc: misc,
        mop: formData.mop,
        type: "COLLECTION",
        proofLink: finalProofLink,
        status: "PENDING",
        notes: formData.notes
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      toast.success("Payment submitted successfully");
      goto("/resident/payment-requests");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Add Payment Request" />
  <div class="mx-auto max-w-3xl space-y-6">
    {#if isLoading}
      <LoadingView />
    {:else if error}
      <ErrorView error={error || "Account record not found."} />
    {:else}
      <Card.Root>
        <Card.Content class="space-y-8">
          <!-- General Info Section -->
          <div class="space-y-4">
            <Label
              class="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase"
            >
              <Calendar class="h-3.5 w-3.5" /> General Information
            </Label>
            <div class="grid gap-6 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Transaction Date</Label>
                <Input type="date" bind:value={formData.date} disabled={isSubmitting} />
              </div>
              <div class="space-y-2">
                <Label>Payment Method</Label>
                <Combobox
                  bind:value={formData.mop}
                  options={mopTypes}
                  disabled={isSubmitting}
                  class="w-full"
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
                  <Label>Water Fee</Label>
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
                  <Label>New Water Balance</Label>
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
                  <Label>Association Fee</Label>
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
                  <Label>New Association Balance</Label>
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
                <Label>Misc / Other Payments</Label>
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
                <Label>Proof of Payment Link</Label>
                {#if uiSettings.firebaseEnabled}
                  {#if formData.proofLink}
                    <Card.Root
                      class="group relative max-w-sm overflow-hidden border-brand/20 bg-brand/5"
                    >
                      <img
                        src={previewUrl || formData.proofLink}
                        alt="Payment Proof"
                        class="aspect-video w-full object-cover transition-all group-hover:blur-[2px]"
                      />
                      <div
                        class="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Button
                          size="sm"
                          onclick={handleRemoveImage}
                          class="h-8 gap-2 px-3 shadow-lg"
                        >
                          <Trash2 class="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                      <div
                        class="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-brand shadow-sm backdrop-blur-sm"
                      >
                        <ImageIcon class="h-3 w-3" />
                        <span>IMAGE ATTACHED</span>
                      </div>
                    </Card.Root>
                  {:else}
                    <div class="flex gap-2">
                      <Input
                        placeholder="Drive or Image Link"
                        bind:value={formData.proofLink}
                        disabled={isSubmitting || isUploading}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        class="shrink-0"
                        disabled={isSubmitting || isUploading}
                        isLoading={isUploading}
                        onclick={() => fileInput?.click()}
                        icon={Upload}
                      />
                    </div>
                  {/if}
                  <input
                    type="file"
                    bind:this={fileInput}
                    accept="image/*"
                    class="hidden"
                    onchange={handleFileUpload}
                  />
                  {#if isUploading}
                    <p class="animate-pulse text-xs font-bold text-brand">Uploading image...</p>
                  {:else if !formData.proofLink}
                    <p class="text-xs text-muted-foreground">
                      Paste a link or upload an image. If using a Google Drive link, make sure it's
                      shared with 'Anyone with the link' permission.
                    </p>
                  {/if}
                {:else}
                  <Input
                    placeholder="https://drive.google.com/..."
                    bind:value={formData.proofLink}
                    disabled={isSubmitting}
                  />
                  <p class="text-xs text-muted-foreground">
                    If using a Google Drive link, make sure it's shared with 'Anyone with the link'
                    permission.
                  </p>
                {/if}
              </div>
              <div class="space-y-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Optional notes about this payment…"
                  bind:value={formData.notes}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Summary Section -->
      <div class="space-y-4">
        <div
          class="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-500"
        >
          <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
          <p class="text-sm font-medium">
            Once submitted, this request cannot be modified. If you make a mistake, please create a
            new request and cancel the previous one.
          </p>
        </div>

        <div class="rounded-xl border border-brand/10 bg-brand/5 p-6">
          <div class="flex">
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
          </div>
        </div>
      </div>

      <Button
        size="lg"
        class="w-full gap-3 font-bold"
        onclick={handleSubmit}
        isLoading={isSubmitting}
        icon={HandCoins}
      >
        Submit Payment
      </Button>
    {/if}
  </div>
</div>
