<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import TermFilter from "$components/TermFilter.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import * as Tabs from "$ui/tabs";
  import AchievementLeaderboard from "$components/achievements/AchievementLeaderboard.svelte";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs
  } from "$api/controllers/achievement-controller";
  import { fetchUserSettings } from "$api/controllers/settings-controller";
  import { fetchTermCurr, fetchUsers } from "$api/controllers/resident-controller";
  import { uiSettings } from "$state/settings.svelte";
  import { pageState } from "$state/page-info.svelte";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentTerm = $state("");
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;

    try {
      const [achievementRows, logRows, users, settings, term, activeTerm] = await Promise.all([
        fetchAdminAchievements(bypassCache),
        fetchAchievementLogs(bypassCache),
        fetchUsers(bypassCache),
        fetchUserSettings(bypassCache),
        fetchTermCurr(bypassCache),
        uiSettings.ensureCurrentTerm()
      ]);

      const userMap = new Map(
        users.map((user) => {
          return [user.id, user.displayName || "Resident"];
        })
      );
      const publicMap = new Map(
        settings.map((setting) => {
          return [setting.residentId, setting.isPublicAchievementList];
        })
      );

      achievements = achievementRows;
      logs = logRows.map((log) => {
        const isPublic = publicMap.get(log.accountId) !== false;
        return {
          ...log,
          displayName: isPublic ? userMap.get(log.accountId) || "Resident" : "Private Player",
          isPublic
        };
      });
      currentTerm = term || activeTerm;
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
  <SubpageHeader
    title="Leaderboards"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <Tabs.Root bind:value={scope}>
        <Tabs.List>
          <Tabs.Trigger value="term">Term</Tabs.Trigger>
          <Tabs.Trigger value="global">Global</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
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
      <FilterDrawer>
        <div class="grid gap-2 lg:grid-cols-12">
          <div class="lg:col-span-3">
            <TermFilter bind:value={selectedTerm} />
          </div>
        </div>
      </FilterDrawer>
    {/if}
    <AchievementLeaderboard {achievements} {logs} term={effectiveTerm} {isGlobal} />
  {/if}
</div>
