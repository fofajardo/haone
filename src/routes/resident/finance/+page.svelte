<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import FinancialStandingCard from "$components/residents/FinancialStandingCard.svelte";
  import ClearanceCard from "$components/residents/ClearanceCard.svelte";
  import TransactionHistoryCard from "$components/residents/TransactionHistoryCard.svelte";

  import { pageState } from "$state/page-info.svelte";
  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  let status = $state<any>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  import { uiSettings } from "$state/settings.svelte";

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      status = await fetchResidentStatus(uiSettings.currentTerm, bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Finance";
  });

  $effect(() => {
    uiSettings.currentTerm;
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Finance"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    hasFilter={true}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else if status}
    {#if status.account}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FinancialStandingCard account={status.account} />
        <ClearanceCard account={status.account} />
      </div>
    {/if}
    <TransactionHistoryCard
      history={status.transactions || []}
      onRowClick={(r) => r.prRefNo && window.open(`/receipt/${r.id}`, "_blank")}
    />
  {/if}
</div>
