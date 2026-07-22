<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Trophy } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import {
    fetchAchievements,
    calculateAchievementPercentage
  } from "$logic/shared-records-logic";
  import { fetchUsers } from "$logic/resident-logic";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/types";
  import { pageState } from "$state/page-info.svelte";
  import EmptyView from "$components/EmptyView.svelte";

  import AchievementCard from "$components/achievements/AchievementCard.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentResidentId = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [achResult] = await Promise.all([fetchAchievements(true)]);

      if (Array.isArray(achResult)) {
        achievements = achResult;
      } else {
        achievements = achResult.achievements;
        currentResidentId = achResult.currentResidentId;
      }

      logs = achResult.logs;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Achievements";
    loadData();
  });

  let earnedIds = $derived(
    new Set(
      logs
        .filter((l) => {
          if (!currentResidentId && !auth.user?.email) {
            return false;
          }
          return l.accountId === currentResidentId || l.accountId === auth.user?.email;
        })
        .map((l) => {
          return l.achievementId;
        })
    )
  );

  let earnedAchievements = $derived(
    achievements.filter((a) => {
      return earnedIds.has(a.id);
    })
  );

  let lockedAchievements = $derived(
    achievements.filter((a) => {
      return !earnedIds.has(a.id);
    })
  );
</script>

<div class="space-y-6">
  <SubpageHeader title="Achievements" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
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
        class="mt-4">Retry</Button
      >
    </ErrorView>
  {:else}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each earnedAchievements as a}
        <div class="h-full">
          <AchievementCard
            achievement={a}
            isEarned={true}
            percentage={calculateAchievementPercentage(
              logs.filter((l) => {
                return l.achievementId === a.id;
              }).length,
              a.totalEligibleCount || 0
            )}
            href="/resident/achievements/{a.id}"
            showStatusBadge={true}
          />
        </div>
      {/each}

      {#if lockedAchievements.length > 0}
        <div class="h-full">
          <AchievementCard
            achievement={lockedAchievements[0]}
            isEarned={false}
            percentage={0}
            href=""
            showStatusBadge={true}
            lockedCount={lockedAchievements.length}
          />
        </div>
      {/if}

      {#if achievements.length === 0}
        <div class="col-span-full">
          <EmptyView
            title="No Achievements Available"
            description="Keep participating in dormitory activities to unlock rewards."
          >
            {#snippet icon()}
              <Trophy class="h-12 w-12 text-muted-foreground" />
            {/snippet}
          </EmptyView>
        </div>
      {/if}
    </div>
  {/if}
</div>
