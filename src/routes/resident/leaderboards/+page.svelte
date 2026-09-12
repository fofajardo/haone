<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import AchievementTabs from "$components/tabs/AchievementTabs.svelte";
  import AchievementLeaderboard from "$components/residents/AchievementLeaderboard.svelte";
  import { fetchAchievements } from "$api/controllers/achievement-controller";
  import { uiSettings } from "$state/settings.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import { pageState } from "$state/page-info.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;

    try {
      const [achResult] = await Promise.all([fetchAchievements(bypassCache)]);

      achievements = Array.isArray(achResult) ? achResult : achResult.achievements;
      logs = Array.isArray(achResult) ? achResult : achResult.logs;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Leaderboards";
  });

  $effect(() => {
    uiSettings.currentTerm;
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Leaderboards"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  >
    {#snippet tabs()}
      <AchievementTabs bind:value={scope} />
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button
        onclick={() => {
          loadData();
        }}
        class="mt-4"
        {isLoading}
        icon={RefreshCcw}>Retry</Button
      >
    </ErrorView>
  {:else}
    <AchievementLeaderboard {achievements} {logs} term={uiSettings.currentTerm} {isGlobal} />
  {/if}
</div>
