<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { Search, RefreshCcw, Plus, ReceiptText, Wallet } from "@lucide/svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import {
    fetchPaymentRequests,
    cancelPaymentRequest
  } from "$api/controllers/payment-request-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { type PaymentRequestRecord, PaymentRequestStatus } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { pageState } from "$state/page-info.svelte";
  import { goto } from "$app/navigation";
  import * as AlertDialog from "$ui/alert-dialog";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";

  let payments = $state<PaymentRequestRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let requestToCancel = $state<string | null>(null);
  let isCancelDialogOpen = $state(false);
  let isCancelling = $state(false);
  let currentResidentId = $state("");
  let searchQuery = $state("");
  let statusFilter = $state<string>("");

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: PaymentRequestStatus.PENDING, label: "Pending" },
    { value: PaymentRequestStatus.APPROVED, label: "Approved" },
    { value: PaymentRequestStatus.DECLINED, label: "Declined" },
    { value: PaymentRequestStatus.CANCELLED, label: "Cancelled" }
  ];

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const [pmtResult] = await Promise.all([fetchPaymentRequests(bypassCache)]);

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
    if (!requestToCancel) {
      return;
    }
    isCancelling = true;
    try {
      await cancelPaymentRequest(requestToCancel);
      toast.success("Payment request cancelled");
      requestToCancel = null;
      isCancelDialogOpen = false;
      await loadData();
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

  let filteredPayments = $derived.by(() => {
    const s = searchQuery.toLowerCase().trim();
    return payments.filter((p) => {
      const matchesSearch =
        !s || (p.mop || "").toLowerCase().includes(s) || (p.notes || "").toLowerCase().includes(s);
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  });
</script>

<div class="space-y-3">
  <SubpageHeader
    title="Payment Requests"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <Button size="sm" href="/resident/payment-requests/add" icon={Plus}>Add</Button>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <FilterDrawer activeCount={Number(searchQuery !== "") + Number(statusFilter !== "")}>
      <div class="grid gap-4 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-8">
          <Label>Search</Label>
          <div class="relative">
            <Search
              class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={searchQuery}
              placeholder="Search by MOP or notes…"
              class="h-9 pl-9"
            />
          </div>
        </div>

        <div class="space-y-1 lg:col-span-4">
          <Label>Status</Label>
          <Combobox
            bind:value={statusFilter}
            options={statusOptions}
            placeholder="Select status..."
            class="h-9"
          />
        </div>
      </div>
    </FilterDrawer>

    <div class="space-y-4">
      {#if filteredPayments.length > 0}
        <DataTable
          data={filteredPayments}
          {columns}
          rowId="id"
          meta={{
            onCancel: confirmCancel
          }}
        />
      {:else}
        <EmptyView
          title="No payment requests found."
          description={searchQuery || statusFilter
            ? "Try adjusting your filters or search query."
            : "Any payments you submit will appear here."}
        >
          {#snippet icon()}
            {#if searchQuery || statusFilter}
              <Wallet class="h-8 w-8 text-muted-foreground" />
            {:else}
              <ReceiptText class="h-8 w-8 text-muted-foreground" />
            {/if}
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
        This action cannot be undone. This will permanently cancel your pending payment request.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isCancelling} onclick={() => (requestToCancel = null)}
        >Go Back</AlertDialog.Cancel
      >
      <Button
        variant="destructive"
        onclick={handleCancel}
        isLoading={isCancelling}
        disabled={isCancelling}
      >
        Confirm
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
