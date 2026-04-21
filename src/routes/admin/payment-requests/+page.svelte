<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Search, Wallet, ListChecks } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import { fetchPaymentRequests, approvePaymentRequest } from "$lib/shared-records-logic";
  import { fetchResidents, fetchTermCurr } from "$lib/resident-logic";
  import { uiSettings } from "$lib/settings.svelte";
  import { toast } from "svelte-sonner";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { goto } from "$app/navigation";
  import { formatAmount } from "$lib/receipt-utils";

  let payments = $state<any[]>([]);
  let residents = $state<any[]>([]);
  let currentTerm = $state("");
  let selectedIndices = $state<Set<string>>(new Set());
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");

  async function loadData(forceRefresh = false) {
    isLoading = true;
    error = null;
    try {
      const [p, r, t] = await Promise.all([
        fetchPaymentRequests(forceRefresh),
        fetchResidents(forceRefresh),
        fetchTermCurr(forceRefresh)
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

  let filteredPayments = $derived(
    payments.filter((p) => {
      const s = searchQuery.toLowerCase();
      return p.residentId.toLowerCase().includes(s) || p.mop.toLowerCase().includes(s);
    })
  );

  function handleReviewSelected() {
    if (selectedIndices.size === 0) return;
    const ids = Array.from(selectedIndices).join(",");
    goto(`/admin/payment-requests/review?ids=${ids}`);
  }

  onMount(loadData);
</script>

<div class="space-y-6">
  <SubpageHeader title="Payment Requests" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
        </Button>
        <Button
          size="sm"
          onclick={handleReviewSelected}
          disabled={isLoading || selectedIndices.size === 0}
        >
          <ListChecks class="mr-2 h-4 w-4" /> Review
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading && payments.length === 0}
    <LoadingView text="Loading payments…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="space-y-1">
      <Label class="text-xs font-bold text-muted-foreground uppercase">Search</Label>
      <div class="relative">
        <Search class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          bind:value={searchQuery}
          placeholder="Search by resident ID or MOP…"
          class="h-9 pl-9 text-xs"
        />
      </div>
    </div>

    {#if filteredPayments.length > 0}
      <DataTable
        data={filteredPayments}
        {columns}
        onSelectionChange={(ids) => (selectedIndices = ids)}
        rowId="id"
        enableSelection
        meta={{
          residents
        }}
      />
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
