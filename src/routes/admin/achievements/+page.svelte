<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Trophy } from "@lucide/svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs,
    addAchievement
  } from "$api/controllers/achievement-controller";
  import { fetchResidents, fetchTermCurr, fetchUsers } from "$api/controllers/resident-controller";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import * as Dialog from "$ui/dialog";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { toast } from "svelte-sonner";
  import { Checkbox } from "$ui/checkbox";
  import TermFilter from "$components/TermFilter.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import ScopeSwitcher from "$components/achievements/ScopeSwitcher.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { calculateAchievementPercentage } from "$api/controllers/achievement-controller";
  import AchievementCard from "$components/achievements/AchievementCard.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let currentTerm = $state("");
  let currentUserId = $state("");
  let totalUsersCount = $state(0);
  let scope = $state("global");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  let isCreatorOpen = $state(false);

  let newAchievement = $state({
    name: "",
    description: "",
    icon: "🏆",
    extraUrl: "",
    points: 10,
    term: "",
    isIndefinite: false
  });

  let filteredAchievements = $derived(
    achievements.filter((a) => {
      if (isGlobal) {
        return true;
      }
      const isIndefinite = !a.term;
      if (isIndefinite) {
        return uiSettings.showAllTimeAchievements;
      }
      return a.term === uiSettings.currentTerm;
    })
  );

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const [a, l, r, t, allU] = await Promise.all([
        fetchAdminAchievements(bypassCache),
        fetchAchievementLogs(bypassCache),
        fetchResidents(bypassCache),
        fetchTermCurr(bypassCache),
        fetchUsers(bypassCache)
      ]);
      const accountsCountMap = new Map<string, number>();
      r.forEach((res) => {
        const term = (res.period || "").trim();
        if (term) {
          accountsCountMap.set(term, (accountsCountMap.get(term) || 0) + 1);
        }
      });

      achievements = a.map((ach) => {
        const eligible = ach.term ? accountsCountMap.get(ach.term) || 0 : allU.length;
        return {
          ...ach,
          totalEligibleCount: eligible
        };
      });
      logs = l;
      currentTerm = t;
      totalUsersCount = allU.length;
      const currTerm = await uiSettings.ensureCurrentTerm();
      if (!newAchievement.term) {
        newAchievement.term = currTerm;
      }
      currentUserId = auth.userId;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleCreate() {
    try {
      await addAchievement({
        id: crypto.randomUUID(),
        creatorId: currentUserId,
        name: newAchievement.name,
        description: newAchievement.description,
        icon: newAchievement.icon,
        extraUrl: newAchievement.extraUrl,
        points: Number(newAchievement.points) || 0,
        term: newAchievement.isIndefinite ? "" : newAchievement.term || currentTerm
      });
      toast.success("Achievement created");
      isCreatorOpen = false;
      newAchievement = {
        name: "",
        description: "",
        icon: "🏆",
        extraUrl: "",
        points: 10,
        term: currentTerm,
        isIndefinite: false
      };
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  onMount(loadData);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Achievements"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    hasFilter={!isGlobal}
    actions={[
      {
        label: "New",
        icon: Plus,
        onclick: () => {
          isCreatorOpen = true;
        }
      }
    ]}
  >
    {#snippet legacyActions()}
      <div class="flex flex-wrap items-center gap-2">
        <ScopeSwitcher bind:value={scope} />
      </div>
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    {#if !isGlobal}
      <FilterDrawer>
        <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div class="w-full sm:w-64">
            <TermFilter
              onSelect={() => {
                loadData();
              }}
            />
          </div>
          <div class="flex items-center space-x-2 pb-1.5">
            <Checkbox id="admin-show-all-time" bind:checked={uiSettings.showAllTimeAchievements} />
            <Label for="admin-show-all-time" class="cursor-pointer text-xs font-medium">
              Show all-time achievements
            </Label>
          </div>
        </div>
      </FilterDrawer>
    {/if}

    <div class="flex flex-col gap-2.5">
      {#each filteredAchievements as a}
        {@const uniqueEarnersCount = new Set(
          logs.filter((l) => l.achievementId === a.id).map((l) => l.accountId)
        ).size}
        <div>
          <AchievementCard
            achievement={a}
            alwaysShowPercentage={true}
            percentage={calculateAchievementPercentage(
              uniqueEarnersCount,
              a.totalEligibleCount || 0
            )}
            href="/admin/achievements/{a.id}"
          />
        </div>
      {:else}
        <EmptyView
          title="No achievements defined."
          description="Achievements created by admins will appear here."
          class="col-span-full py-8"
        >
          {#snippet icon()}
            <Trophy class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/each}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={isCreatorOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>New Achievement</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="grid grid-cols-4 gap-4">
        <div class="space-y-2">
          <Label for="icon">Icon/Emoji</Label>
          <Input id="icon" bind:value={newAchievement.icon} />
        </div>
        <div class="col-span-3 space-y-2">
          <Label for="name">Name</Label>
          <Input id="name" bind:value={newAchievement.name} />
        </div>
      </div>
      <div class="space-y-2">
        <Label for="desc">Description</Label>
        <Textarea id="desc" bind:value={newAchievement.description} />
      </div>
      <div class="space-y-2">
        <Label for="url">Extra URL (optional)</Label>
        <Input id="url" bind:value={newAchievement.extraUrl} placeholder="https://..." />
      </div>
      <div class="space-y-2">
        <Label for="points">XP</Label>
        <Input id="points" type="number" min="0" bind:value={newAchievement.points} />
      </div>
      <div class="flex items-center space-x-2 py-2">
        <Checkbox id="is-indefinite" bind:checked={newAchievement.isIndefinite} />
        <Label for="is-indefinite" class="cursor-pointer text-sm leading-none font-medium"
          >Indefinite unlocking period</Label
        >
      </div>
      {#if !newAchievement.isIndefinite}
        <div class="animate-in space-y-2 duration-200 fade-in-50">
          <TermFilter bind:value={newAchievement.term} />
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          isCreatorOpen = false;
        }}>Cancel</Button
      >
      <Button onclick={handleCreate} {isLoading} icon={Plus}>Create</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
