<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Trophy, Users, Lock as LockIcon } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import {
    fetchAchievements,
    fetchAchievementLogs,
    fetchUserSettings
  } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  const id = page.params.id;

  let achievement = $state<AchievementRecord | null>(null);
  let earners = $state<{ residentId: string; name: string; date: string; isPublic: boolean }[]>([]);
  let currentResidentId = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [achResult, logResult, allU, allS] = await Promise.all([
        fetchAchievements(true),
        fetchAchievementLogs(true),
        fetchUsers(true),
        fetchUserSettings(true)
      ]);

      let allA: AchievementRecord[];
      let allL: AchievementLogRecord[];

      if (Array.isArray(achResult)) {
        allA = achResult;
      } else {
        allA = achResult.achievements;
        currentResidentId = achResult.currentResidentId;
      }

      if (Array.isArray(logResult)) {
        allL = logResult;
      } else {
        allL = logResult.logs;
      }

      achievement = allA.find((a) => a.id === id) || null;
      if (!achievement) throw new Error("Achievement not found");

      const achievementLogs = allL.filter((l) => l.achievementId === id);

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
  <SubpageHeader title="Achievement Details" />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else if achievement}
    <div class="grid gap-8 lg:grid-cols-3">
      <div class="lg:col-span-1">
        <Card.Root class="border-brand/20 bg-brand/5 p-8 text-center">
          <div class="mb-6 text-8xl">{achievement.icon || "🏆"}</div>
          <h2 class="text-3xl font-black tracking-tight">{achievement.name}</h2>
          <p class="mt-4 leading-relaxed text-muted-foreground">{achievement.description}</p>
          {#if achievement.extraUrl}
            <Button variant="link" href={achievement.extraUrl} target="_blank" class="mt-4"
              >Learn More</Button
            >
          {/if}
        </Card.Root>
      </div>

      <div class="space-y-6 lg:col-span-2">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-xl font-bold">
            <Users class="h-5 w-5 text-brand" /> Earned By
          </h3>
          <Badge variant="secondary" class="font-black tracking-tighter uppercase"
            >{earners.length} Residents</Badge
          >
        </div>

        {#if earners.some((e) => e.residentId === currentResidentId)}
          <div class="grid gap-3 sm:grid-cols-2">
            {#each earners as earner}
              <Card.Root class={earner.isPublic ? "border-brand/20" : "bg-muted/20 opacity-60"}>
                <Card.Content class="flex items-center justify-between p-4">
                  <div class="space-y-0.5">
                    <div
                      class="text-sm font-bold {earner.isPublic
                        ? 'text-foreground'
                        : 'text-muted-foreground italic'}"
                    >
                      {earner.name}
                    </div>
                    <div
                      class="text-xs font-black tracking-tighter text-muted-foreground uppercase"
                    >
                      {earner.date}
                    </div>
                  </div>
                  {#if earner.isPublic}
                    <Trophy class="h-4 w-4 text-brand" />
                  {/if}
                </Card.Content>
              </Card.Root>
            {/each}
          </div>
        {:else}
          <div
            class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-muted/5 p-12"
          >
            <LockIcon class="mb-4 h-8 w-8 text-muted-foreground" />
            <p class="text-sm font-medium text-muted-foreground">
              Earn this achievement to see who else has it!
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
