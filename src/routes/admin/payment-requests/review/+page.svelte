<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button";
  import { ArrowLeft, CircleX, ExternalLink, ChevronLeft, ChevronRight } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import TransactionForm from "$lib/components/TransactionForm.svelte";
  import { fetchPaymentRequests, declinePaymentRequest } from "$lib/admin-logic";
  import { fetchResidents, fetchTermCurr, fetchUsers } from "$lib/resident-logic";
  import { PaymentRequestStatus } from "$lib/schemas";
  import { uiSettings } from "$lib/settings.svelte";
  import { toast } from "svelte-sonner";
  import { formatAmount, translateMop } from "$lib/receipt-utils";
  import { Textarea } from "$lib/components/ui/textarea";
  import { goto } from "$app/navigation";
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";
  import { appendSheetRow, updateSheetValue, fetchSheetRowsRaw } from "$lib/google-sheets";
  import { auth } from "$lib/auth.svelte";

  let payments = $state<any[]>([]);
  let residents = $state<any[]>([]);
  let users = $state<any[]>([]);
  let currentTerm = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let currentIndex = $state(0);
  let declineReason = $state("");
  let isProcessing = $state(false);
  let stagedForms = $state<Record<string, any>>({});

  const ids = $derived(page.url.searchParams.get("ids")?.split(",") || []);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [p, r, t, u] = await Promise.all([
        fetchPaymentRequests(true),
        fetchResidents(true),
        fetchTermCurr(true),
        fetchUsers(true)
      ]);

      const filtered = p.filter(
        (item) => ids.includes(item.id) && item.status === PaymentRequestStatus.PENDING
      );

      // Initialize staged forms BEFORE setting reactive payments list
      filtered.forEach((p) => {
        const resident = r.find((res) => res.residentId === p.residentId);
        const user = u.find((usr) => usr.id === p.residentId);
        stagedForms[p.id] = {
          date: p.date,
          creator: auth.user?.email || "",
          account: resident?.email || user?.email || p.residentId,
          water: p.waterFee,
          assoc: p.assocFee,
          misc: p.misc,
          mop: p.mop,
          period: t,
          type: "PMT_COLLECTION",
          notes: p.notes || "",
          notesPrivate: "",
          mopRefNo: "",
          prDateIssued: "",
          prRefNo: "",
          creatorName: auth.user?.name || "",
          name: resident?.name || user?.displayName || "",
          stno: resident?.stno || user?.studentNo || "",
          wasAudited: false,
          receiptUrl: "",
          id: "",
          amount: p.waterFee + p.assocFee + p.misc,
          raw: []
        };
      });

      payments = filtered;
      residents = r;
      currentTerm = t;
      users = u;

      if (payments.length === 0) {
        error = "No pending payment requests found for the selected IDs.";
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  let currentPayment = $derived(payments[currentIndex]);
  let currentResident = $derived(
    currentPayment ? residents.find((r) => r.residentId === currentPayment.residentId) : null
  );

  async function handleDecline() {
    if (!currentPayment || !declineReason.trim()) return;
    const paymentId = currentPayment.id;
    isProcessing = true;
    try {
      await declinePaymentRequest(paymentId, declineReason);
      toast.success("Payment request declined");
      declineReason = "";

      // Remove from local queue
      payments = payments.filter((p) => p.id !== paymentId);

      if (payments.length === 0) {
        goto("/admin/payment-requests");
      } else {
        // Adjust index if we were at the end
        if (currentIndex >= payments.length) {
          currentIndex = payments.length - 1;
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isProcessing = false;
    }
  }

  async function handleSaveReview(row: any[]) {
    if (!currentPayment) return;
    isProcessing = true;
    try {
      const awId = uiSettings.accountingWorkbookId;
      const srId = uiSettings.sharedRecordsId;
      if (!awId || !srId) throw new Error("Spreadsheet IDs not configured");

      // 1. Add to journal
      await appendSheetRow(awId, "journal_general!A:T", [row]);

      // 2. Mark as APPROVED in payment_requests sheet
      const srRows = await fetchSheetRowsRaw(srId, "payment_requests!A:L");
      const rowIndex = srRows.findIndex(
        (r) => (r[0]?.toString() || "").trim() === currentPayment.id
      );

      if (rowIndex === -1) {
        throw new Error("Payment record not found in sheet for approval update");
      }

      const actualRow = rowIndex + 1;
      await updateSheetValue(srId, `payment_requests!J${actualRow}`, [
        [PaymentRequestStatus.APPROVED]
      ]);

      toast.success("Transaction added and payment request approved");

      // Remove from local queue
      const oldIndex = currentIndex;
      payments = payments.filter((_, i) => i !== oldIndex);

      if (payments.length === 0) {
        goto("/admin/payment-requests");
      } else {
        currentIndex = Math.min(currentIndex, payments.length - 1);
      }
    } catch (e: any) {
      toast.error(e.message);
      throw e;
    } finally {
      isProcessing = false;
    }
  }

  function handleStateChange(formData: any) {
    if (!currentPayment) return;
    stagedForms[currentPayment.id] = {
      ...stagedForms[currentPayment.id],
      date: formData.date,
      account: formData.accountEmail,
      water: parseFloat(formData.waterFee) || 0,
      assoc: parseFloat(formData.assocFee) || 0,
      misc: parseFloat(formData.miscFee) || 0,
      mop: formData.mop,
      period: formData.period,
      type: formData.type,
      notes: formData.notes,
      notesPrivate: formData.notesPrivate,
      mopRefNo: formData.mopRefNo,
      prDateIssued: formData.prDateIssued,
      prRefNo: formData.prRefNo,
      name: formData.accountName,
      stno: formData.accountStNo
    };
  }

  onMount(loadData);
</script>

<div class="space-y-6">
  <SubpageHeader title="Review Queue" isTopLevel={false}>
    {#snippet actions()}
      <div class="flex items-center gap-4">
        {#if payments.length > 0}
          <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span class="text-foreground">{currentIndex + 1}</span>
            <span>of</span>
            <span>{payments.length}</span>
          </div>
          <div class="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onclick={() => (currentIndex = Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0 || isProcessing}
              icon={ChevronLeft}
            />
            <Button
              variant="outline"
              size="sm"
              onclick={() => (currentIndex = Math.min(payments.length - 1, currentIndex + 1))}
              disabled={currentIndex === payments.length - 1 || isProcessing}
              icon={ChevronRight}
            />
          </div>
        {/if}
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading review queue…" />
  {:else if error}
    <ErrorView {error}>
      <Button
        onclick={() => goto("/admin/payment-requests")}
        variant="outline"
        class="mt-4"
        icon={ArrowLeft}>Back to List</Button
      >
    </ErrorView>
  {:else if currentPayment}
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left: Request Details -->
      <div class="space-y-4 lg:col-span-1">
        <Card.Root>
          <Card.Header class="pb-2">
            <Card.Title class="text-lg">Original Request</Card.Title>
            <Card.Description>Submitted details from resident</Card.Description>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-3 rounded-xl border bg-muted/30 p-4">
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">Resident:</span>
                  <span class="font-medium"
                    >{currentResident?.name || currentPayment.residentId}</span
                  >
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">Date:</span>
                  <span class="font-medium">{currentPayment.date}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">MOP:</span>
                  <Badge variant="outline" class="uppercase"
                    >{translateMop(currentPayment.mop)}</Badge
                  >
                </div>

                <div class="mt-2 border-t pt-2">
                  <div class="flex justify-between text-sm">
                    <span class="text-xs text-muted-foreground uppercase">Water:</span>
                    <span>{formatAmount(currentPayment.waterFee)}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-xs text-muted-foreground uppercase">Assoc:</span>
                    <span>{formatAmount(currentPayment.assocFee)}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-xs text-muted-foreground uppercase">Misc:</span>
                    <span>{formatAmount(currentPayment.misc)}</span>
                  </div>
                  <div class="mt-1 flex justify-between border-t pt-1 text-sm font-bold">
                    <span>Total:</span>
                    <span class="text-primary">
                      {formatAmount(
                        currentPayment.waterFee + currentPayment.assocFee + currentPayment.misc
                      )}
                    </span>
                  </div>
                </div>

                {#if currentPayment.proofLink}
                  <div class="pt-2">
                    <Button
                      variant="link"
                      class="flex h-auto gap-1 p-0 text-xs"
                      href={currentPayment.proofLink}
                      target="_blank"
                    >
                      <ExternalLink class="h-3 w-3" /> View Proof of Payment
                    </Button>
                  </div>
                {/if}

                {#if currentPayment.notes}
                  <div class="border-t pt-2 text-xs">
                    <span class="font-bold text-muted-foreground uppercase">Resident Notes:</span>
                    <p class="mt-1 italic">{currentPayment.notes}</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Decline Action -->
            <div class="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <h4 class="text-xs font-bold tracking-wider text-destructive uppercase">
                Decline Request
              </h4>
              <Textarea
                placeholder="Reason for declining..."
                bind:value={declineReason}
                class="bg-background text-xs"
              />
              <Button
                variant="destructive"
                size="sm"
                class="w-full"
                onclick={handleDecline}
                isLoading={isProcessing}
                disabled={!declineReason.trim()}
                icon={CircleX}
              >
                Decline Request
              </Button>
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Right: Processing Form -->
      <div class="lg:col-span-2">
        {#key currentPayment.id}
          <TransactionForm
            mode="add"
            hideHeader={true}
            initialData={stagedForms[currentPayment.id]}
            isSubmitting={isProcessing}
            onSave={handleSaveReview}
            onCancel={() => goto("/admin/payment-requests")}
            onStateChange={handleStateChange}
          />
        {/key}
      </div>
    </div>
  {/if}
</div>
