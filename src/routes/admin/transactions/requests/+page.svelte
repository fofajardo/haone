<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Search, Wallet, ListChecks, FunnelX } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import AdminTransactionsHeaderActions from "$components/transactions/AdminTransactionsHeaderActions.svelte";
  import { columns } from "./columns";
  import { fetchAdminPaymentRequests } from "$api/controllers/payment-request-controller";
  import { fetchResidents, fetchTermCurr } from "$api/controllers/resident-controller";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { goto } from "$app/navigation";
  import { PaymentRequestStatus } from "$lib/types";
  import { Combobox } from "$ui/combobox";

  let payments = $state<any[]>([]);
  let residents = $state<any[]>([]);
  let currentTerm = $state("");
  let selectedIndices = $state<Set<string>>(new Set());
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let statusFilter = $state<string>(PaymentRequestStatus.PENDING);

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
      const [p, r, t] = await Promise.all([
        fetchAdminPaymentRequests(bypassCache),
        fetchResidents(bypassCache),
        fetchTermCurr(bypassCache)
      ]);
      payments = p;
      residents = r;
      currentTerm = t;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  let filteredPayments = $derived.by(() => {
    const s = searchQuery.toLowerCase().trim();
    return payments.filter((p) => {
      const matchesSearch =
        !s ||
        (p.residentId || "").toLowerCase().includes(s) ||
        (p.mop || "").toLowerCase().includes(s) ||
        (p.notes || "").toLowerCase().includes(s);
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  });

  function handleReviewSelected() {
    if (selectedIndices.size === 0) {
      return;
    }
    const ids = Array.from(selectedIndices).join(",");
    goto(`/admin/transactions/requests/review?ids=${ids}`);
  }

  onMount(loadData);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <SubpageHeader
    title="Transactions"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <AdminTransactionsHeaderActions active="requests" />
    {/snippet}
  </SubpageHeader>

  {#if isLoading && payments.length === 0}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <FilterDrawer
      activeCount={Number(searchQuery !== "") +
        Number(statusFilter !== PaymentRequestStatus.PENDING)}
    >
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-7">
          <Label>Search</Label>
          <div class="relative">
            <Search
              class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={searchQuery}
              placeholder="Search by resident ID, MOP, or notes…"
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

        <div class="flex items-end lg:col-span-1">
          <Button
            variant="outline"
            size="sm"
            onclick={() => {
              searchQuery = "";
              statusFilter = PaymentRequestStatus.PENDING;
            }}
            class="h-9 w-full px-2"
            icon={FunnelX}
          >
            Clear
          </Button>
        </div>
      </div>
    </FilterDrawer>

    {#if filteredPayments.length > 0}
      <DataTable
        data={filteredPayments}
        {columns}
        onSelectionChange={(ids) => (selectedIndices = ids)}
        rowId="id"
        enableSelection
        sorting={[{ id: "date", desc: true }]}
        meta={{
          residents
        }}
      >
        {#snippet actions()}
          <Button size="sm" onclick={handleReviewSelected} {isLoading} icon={ListChecks}>
            Review
          </Button>
        {/snippet}
      </DataTable>
    {:else}
      <EmptyView
        title="No payment requests found."
        description="Try adjusting your filters or search query."
      >
        {#snippet icon()}
          <Wallet class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>
