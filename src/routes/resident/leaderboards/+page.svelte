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
  import { fetchAchievements } from "$lib/logic/shared-records-logic";
  import { uiSettings } from "$lib/state/settings.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/schemas";
  import { pageState } from "$lib/state/page-info.svelte";
  import { fetchServer } from "$lib/utils/api-client";

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
      const [achResult, statusJson] = await Promise.all([
        fetchAchievements(true),
        fetchServer("/api/resident/check-status")
      ]);

      achievements = Array.isArray(achResult) ? achResult : achResult.achievements;
      logs = Array.isArray(achResult) ? achResult : achResult.logs;
      currentTerm = statusJson.currentTerm;

      if (!uiSettings.currentTerm) {
        uiSettings.currentTerm = statusJson.currentTerm;
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
