<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import TermFilter from "$components/TermFilter.svelte";
  import * as Tabs from "$ui/tabs";
  import AchievementLeaderboard from "$components/achievements/AchievementLeaderboard.svelte";
  import { fetchAchievements } from "$api/controllers/achievement-controller";
  import { uiSettings } from "$state/settings.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import { pageState } from "$state/page-info.svelte";
  import { fetchServer } from "$utils/api-client";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentTerm = $state("");
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  import { fetchResidentStatus } from "$api/controllers/resident-controller";

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;

    try {
      const [achResult, statusJson, activeTerm] = await Promise.all([
        fetchAchievements(bypassCache),
        fetchResidentStatus(undefined, bypassCache),
        uiSettings.ensureCurrentTerm()
      ]);

      achievements = Array.isArray(achResult) ? achResult : achResult.achievements;
      logs = Array.isArray(achResult) ? achResult : achResult.logs;
      currentTerm = statusJson.currentTerm || activeTerm;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Leaderboards";
    loadData();
  });
  let selectedTerm = $state(uiSettings.currentTerm || "");

  let effectiveTerm = $derived(selectedTerm || uiSettings.currentTerm || currentTerm);
</script>

<div class="space-y-6">
  <SubpageHeader title="Leaderboards" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex flex-wrap items-center gap-2">
        <Tabs.Root bind:value={scope}>
          <Tabs.List>
            <Tabs.Trigger value="term">Term</Tabs.Trigger>
            <Tabs.Trigger value="global">Global</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <Button
          variant="outline"
          size="sm"
          onclick={() => {
            loadData(true);
          }}
          {isLoading}
          icon={RefreshCcw}
        />
      </div>
    {/snippet}
  </SubpageHeader>

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
    {#if !isGlobal}
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="lg:col-span-3">
          <TermFilter bind:value={selectedTerm} />
        </div>
      </div>
    {/if}

    <AchievementLeaderboard {achievements} {logs} term={effectiveTerm} {isGlobal} />
  {/if}
</div>
