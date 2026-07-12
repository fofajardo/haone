<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import AchievementLeaderboard from "$lib/components/achievements/AchievementLeaderboard.svelte";
  import { fetchAchievements, fetchAchievementLogs } from "$lib/shared-records-logic";
  import { fetchTermCurr } from "$lib/resident-logic";
  import { uiSettings } from "$lib/settings.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/schemas";
  import { pageState } from "$lib/page-info.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentTerm = $state("");
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  async function loadData() {
    isLoading = true;
    error = null;

    try {
      const [achResult, logResult, term] = await Promise.all([
        fetchAchievements(true),
        fetchAchievementLogs(true),
        fetchTermCurr(true)
      ]);

      achievements = Array.isArray(achResult) ? achResult : achResult.achievements;
      logs = Array.isArray(logResult) ? logResult : logResult.logs;
      currentTerm = term;

      if (!uiSettings.currentTerm) {
        uiSettings.currentTerm = term;
      }
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
            loadData();
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
    <div class="grid gap-2 lg:grid-cols-12">
      {#if !isGlobal}
        <div class="lg:col-span-3">
          <TermFilter
            onSelect={() => {
              loadData();
            }}
          />
        </div>
      {/if}
    </div>

    <AchievementLeaderboard
      {achievements}
      {logs}
      term={uiSettings.currentTerm || currentTerm}
      {isGlobal}
    />
  {/if}
</div>
