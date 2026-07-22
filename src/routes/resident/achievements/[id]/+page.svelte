<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { fetchAchievements } from "$lib/logic/shared-records-logic";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/schemas";

  import AchievementDetailsView from "$lib/components/achievements/AchievementDetailsView.svelte";
  import AchievementStoryShareButton from "$lib/components/achievements/AchievementStoryShareButton.svelte";

  const id = page.params.id;

  let achievement = $state<AchievementRecord | null>(null);
  let allLogs = $state<AchievementLogRecord[]>([]);
  let earners = $state<{ residentId: string; name: string; date: string; isPublic: boolean }[]>([]);
  let currentResidentId = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isEarned = $derived(
    allLogs.some((l) => {
      return l.achievementId === id && l.accountId === currentResidentId;
    })
  );

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [achResult] = await Promise.all([fetchAchievements(true)]);

      let allA: AchievementRecord[];

      if (Array.isArray(achResult)) {
        allA = achResult;
      } else {
        allA = achResult.achievements;
        currentResidentId = achResult.currentResidentId;
      }

      allLogs = achResult.logs;

      achievement =
        allA.find((a) => {
          return a.id === id;
        }) || null;
      if (!achievement) {
        throw new Error("Achievement not found");
      }

      const achievementLogs = allLogs.filter((l) => {
        return l.achievementId === id;
      });

      earners = achievementLogs.map((l) => {
        return {
          residentId: l.accountId,
          name: l.displayName || "Private Resident",
          date: l.date,
          isPublic: l.isPublic ?? false
        };
      });
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);
</script>

<div class="space-y-6">
  <SubpageHeader title="Achievement Details">
    {#snippet actions()}
      {#if achievement && isEarned}
        <AchievementStoryShareButton {achievement} />
      {/if}
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
  {:else if achievement && isEarned}
    <AchievementDetailsView {achievement} {earners} isAdmin={false} {currentResidentId} />
  {:else if achievement}
    <div class="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div class="text-9xl animate-pulse">🔒</div>
      <h2 class="text-3xl font-bold tracking-tight">Locked Achievement</h2>
      <p class="max-w-sm text-muted-foreground">
        This achievement is still waiting for you… keep going and you might just unlock it.
      </p>
    </div>
  {/if}
</div>
