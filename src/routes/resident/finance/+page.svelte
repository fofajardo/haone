<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import ResidentTermFilter from "$components/residents/ResidentTermFilter.svelte";
  import FinancialStandingCard from "$components/residents/FinancialStandingCard.svelte";
  import ClearanceCard from "$components/residents/ClearanceCard.svelte";
  import TransactionHistoryCard from "$components/residents/TransactionHistoryCard.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { pageState } from "$state/page-info.svelte";
  import { fetchServer } from "$utils/api-client";
  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  let status = $state<any>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let localTerm = $state(page.url.searchParams.get("term") || "");

  async function loadData(term?: string, bypassCache = false) {
    if (!auth.accessToken) return;
    await loadStatus(term || localTerm, bypassCache);
  }

  async function loadStatus(targetTerm: string, bypassCache = false) {
    if (!auth.user?.email) return;

    const url = new URL(window.location.href);
    if (targetTerm) {
      url.searchParams.set("term", targetTerm);
    }
    replaceState(url.toString(), {});

    isLoading = true;
    error = null;
    try {
      status = await fetchResidentStatus(targetTerm, bypassCache);
      if (status.activeTerm && !targetTerm) {
        // First load with no term — reload with resolved active term so transactions are filtered
        localTerm = status.activeTerm;
        status = await fetchResidentStatus(localTerm, bypassCache);
        const u = new URL(window.location.href);
        u.searchParams.set("term", localTerm);
        replaceState(u.toString(), {});
      } else if (status.activeTerm) {
        localTerm = status.activeTerm;
      }
      pageState.title = "Finance";
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    if (auth.accessToken) {
      loadData();
    } else {
      const interval = setInterval(() => {
        if (auth.accessToken) {
          clearInterval(interval);
          loadData();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 2000);
    }
  });
</script>

<div class="space-y-3">
  <SubpageHeader title="Finance" isTopLevel={true}>
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => loadData(undefined, true)}
        {isLoading}
        icon={RefreshCcw}
      />
    {/snippet}
  </SubpageHeader>

  <FilterDrawer>
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="lg:col-span-3">
        <ResidentTermFilter
          bind:value={localTerm}
          options={status?.allTerms}
          onSelect={() => loadData(localTerm)}
        />
      </div>
    </div>
  </FilterDrawer>

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
      transactionTypes={status.transactionTypes || []}
      onRowClick={(r) => r.prRefNo && window.open(`/receipt/${r.id}`, "_blank")}
    />
  {/if}
</div>
