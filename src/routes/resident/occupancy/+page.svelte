<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw } from "lucide-svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { goto } from "$app/navigation";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import OccupancyHistoryCard from "$lib/components/residents/OccupancyHistoryCard.svelte";
  import StudentProfileCard from "$lib/components/residents/StudentProfileCard.svelte";
  import { pageState } from "$lib/page-info.svelte";
  import { fetchServer } from "$lib/utils";

  let status = $state<any>(null);
  let occupancyData = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData() {
    if (!auth.accessToken) return;
    isLoading = true;
    error = null;
    try {
      const [statusJson, occJson] = await Promise.all([
        fetchServer("/api/resident/check-status"),
        fetchServer("/api/resident/occupancy")
      ]);

      status = statusJson;
      occupancyData = occJson.accounts;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Occupancy";
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
  <SubpageHeader title="Occupancy" isTopLevel={true}>
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

  {#if isLoading && occupancyData.length === 0}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="lg:col-span-4">
        {#if status?.account}
          <StudentProfileCard account={status.account} semesterCount={occupancyData.length} />
        {/if}
      </div>

      <div class="lg:col-span-8">
        <OccupancyHistoryCard
          accounts={occupancyData}
          onRowClick={(r) => goto(`/resident/finance?term=${r.period}`)}
        />
      </div>
    </div>
  {/if}
</div>
