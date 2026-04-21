<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Trophy, Medal, Lock } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { fetchAchievements, fetchAchievementLogs } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { pageState } from "$lib/page-info.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentResidentId = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [achResult, logResult, allU] = await Promise.all([
        fetchAchievements(true),
        fetchAchievementLogs(true),
        fetchUsers(true)
      ]);

      if (Array.isArray(achResult)) {
        achievements = achResult;
      } else {
        achievements = achResult.achievements;
        currentResidentId = achResult.currentResidentId;
      }

      if (Array.isArray(logResult)) {
        logs = logResult;
      } else {
        logs = logResult.logs;
      }
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
          if (!currentResidentId && !auth.user?.email) return false;
          return l.accountId === currentResidentId || l.accountId === auth.user?.email;
        })
        .map((l) => l.achievementId)
    )
  );
</script>

<div class="space-y-6">
  <SubpageHeader title="Achievements" isTopLevel={true}>
    {#snippet actions()}
      <Button variant="outline" size="sm" onclick={() => loadData()} disabled={isLoading}>
        <RefreshCcw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
      </Button>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading achievements…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each achievements as a}
        {@const isEarned = earnedIds.has(a.id)}
        <a href="/resident/achievements/{a.id}" class="group block">
          <Card.Root
            class="h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl {isEarned
              ? 'border-brand/50 bg-brand/5'
              : 'opacity-70 grayscale'}"
          >
            <Card.Header>
              <div class="flex items-center justify-between">
                <div class="text-5xl transition-transform duration-500 group-hover:scale-110">
                  {isEarned ? a.icon || "🏆" : "🔒"}
                </div>
                {#if isEarned}
                  <Badge
                    variant="default"
                    class="bg-brand font-black tracking-tighter text-brand-foreground uppercase"
                    >Earned</Badge
                  >
                {:else}
                  <Badge variant="secondary" class="font-black tracking-tighter uppercase"
                    >Locked</Badge
                  >
                {/if}
              </div>
              <Card.Title class="mt-4 text-xl font-black">{a.name}</Card.Title>
              <Card.Description class="mt-1 line-clamp-2">{a.description}</Card.Description>
            </Card.Header>
          </Card.Root>
        </a>
      {:else}
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
      {/each}
    </div>
  {/if}
</div>
