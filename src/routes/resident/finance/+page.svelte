<script lang="ts">
  import { auth } from "$lib/state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import ResidentTermFilter from "$lib/components/residents/ResidentTermFilter.svelte";
  import FinancialStandingCard from "$lib/components/residents/FinancialStandingCard.svelte";
  import ClearanceCard from "$lib/components/residents/ClearanceCard.svelte";
  import TransactionHistoryCard from "$lib/components/residents/TransactionHistoryCard.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { pageState } from "$lib/state/page-info.svelte";
  import { fetchServer } from "$lib/utils/api-client";

  let status = $state<any>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let localTerm = $state(page.url.searchParams.get("term") || "");

  async function loadData(term?: string) {
    if (!auth.accessToken) return;
    const targetTerm = term || localTerm;

    // Sync URL without reload
    const url = new URL(window.location.href);
    if (targetTerm) {
      url.searchParams.set("term", targetTerm);
    }
    replaceState(url.toString(), {});

    isLoading = true;
    error = null;
    try {
      status = await fetchServer(`/api/resident/check-status?term=${targetTerm}`);
      if (status.activeTerm && !targetTerm) {
        // First load with no term — reload with resolved active term so transactions are filtered
        localTerm = status.activeTerm;
        status = await fetchServer(`/api/resident/check-status?term=${localTerm}`);
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

<div class="space-y-6">
  <SubpageHeader title="Finance" isTopLevel={true}>
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => loadData()}
        {isLoading}
        icon={RefreshCcw}
      />
    {/snippet}
  </SubpageHeader>

  <div class="grid gap-4 lg:grid-cols-12">
    <div class="lg:col-span-3">
      <ResidentTermFilter
        bind:value={localTerm}
        options={status?.allTerms}
        onSelect={() => loadData(localTerm)}
      />
    </div>
  </div>

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
