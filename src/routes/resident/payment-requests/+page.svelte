<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, ReceiptText } from "lucide-svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import { fetchPaymentRequests, cancelPaymentRequest } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { type PaymentRequestRecord } from "$lib/schemas";
  import { toast } from "svelte-sonner";
  import { pageState } from "$lib/page-info.svelte";
  import { goto } from "$app/navigation";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";

  let payments = $state<PaymentRequestRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let requestToCancel = $state<string | null>(null);
  let isCancelDialogOpen = $state(false);
  let isCancelling = $state(false);
  let currentResidentId = $state("");

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [pmtResult, allUsers] = await Promise.all([
        fetchPaymentRequests(true),
        fetchUsers(true)
      ]);

      if (Array.isArray(pmtResult)) {
        payments = pmtResult;
      } else {
        payments = pmtResult.requests;
        currentResidentId = pmtResult.currentResidentId;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleCancel() {
    if (!requestToCancel) return;
    isCancelling = true;
    try {
      await cancelPaymentRequest(requestToCancel);
      toast.success("Payment request cancelled");
      requestToCancel = null;
      isCancelDialogOpen = false;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isCancelling = false;
    }
  }

  function confirmCancel(id: string) {
    requestToCancel = id;
    isCancelDialogOpen = true;
  }

  onMount(() => {
    pageState.title = "Payment Requests";
    loadData();
  });

  let userPayments = $derived(
    payments
      .filter((p) => currentResidentId && p.residentId === currentResidentId)
      .sort((a, b) => b.date.localeCompare(a.date))
  );
</script>

<div class="space-y-6">
  <SubpageHeader title="Payment Requests" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData()}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button size="sm" onclick={() => goto("/resident/payment-requests/add")} icon={Plus}>
          Add
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="space-y-4">
      {#if userPayments.length > 0}
        <DataTable
          data={userPayments}
          {columns}
          rowId="id"
          meta={{
            onCancel: confirmCancel
          }}
        />
      {:else}
        <EmptyView
          title="No payment requests found."
          description="Any payments you submit will appear here."
        >
          {#snippet icon()}
            <ReceiptText class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/if}
    </div>
  {/if}
</div>

<AlertDialog.Root bind:open={isCancelDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Cancel Payment Request?</AlertDialog.Title>
      <AlertDialog.Description>
        This will permanently cancel your pending payment request. You will need to create a new one
        if you wish to proceed.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => (requestToCancel = null)}>Back</AlertDialog.Cancel>
      <AlertDialog.Action
        class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
        onclick={(e) => {
          e.preventDefault();
          handleCancel();
        }}
        disabled={isCancelling}
      >
        {#if isCancelling}
          <RefreshCcw class="mr-2 h-4 w-4 animate-spin" />
        {/if}
        Cancel Request
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
