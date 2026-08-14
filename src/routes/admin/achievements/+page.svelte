<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$state/auth.svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Trophy, UserPlus } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs,
    addAchievement,
    awardAchievement
  } from "$api/controllers/achievement-controller";
  import { fetchResidents, fetchTermCurr, fetchUsers } from "$api/controllers/resident-controller";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/types";
  import * as Dialog from "$ui/dialog";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { toast } from "svelte-sonner";
  import { Combobox } from "$ui/combobox";
  import { Checkbox } from "$ui/checkbox";
  import { translatePeriod } from "$utils/translators";
  import TermFilter from "$components/TermFilter.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import {
    calculateAchievementPercentage,
    getEligibleCount
  } from "$api/controllers/achievement-controller";
  import AchievementCard from "$components/achievements/AchievementCard.svelte";

  import * as Tabs from "$ui/tabs";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let residents = $state<any[]>([]);
  let currentTerm = $state("");
  let currentUserId = $state("");
  let totalUsersCount = $state(0);
  let scope = $state("term");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isGlobal = $derived(scope === "global");

  let isCreatorOpen = $state(false);
  let isAwarderOpen = $state(false);

  let newAchievement = $state({
    name: "",
    description: "",
    icon: "🏆",
    extraUrl: "",
    points: 10,
    term: "",
    isIndefinite: false
  });

  let awardData = $state({
    achievementId: "",
    residentId: ""
  });

  let filteredAchievements = $derived(
    achievements.filter((a) => {
      if (isGlobal) {
        return true;
      }
      const isIndefinite = !a.term;
      if (isIndefinite) {
        return uiSettings.showGlobalAchievements;
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
      achievements = a;
      logs = l;
      currentTerm = t;
      totalUsersCount = allU.length;
      const currTerm = await uiSettings.ensureCurrentTerm();
      residents = r.filter((res) => {
        return res.period === currTerm;
      });
      if (!newAchievement.term) {
        newAchievement.term = currTerm;
      }
      const me = allU.find((u) => {
        return u.email.toLowerCase() === (auth.user?.email || "").toLowerCase();
      });
      currentUserId = me?.id || "";
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

  async function handleAward() {
    if (!awardData.achievementId || !awardData.residentId) {
      toast.error("Please select both achievement and resident");
      return;
    }

    // Local validation to block duplicate awards
    const hasAlready = logs.some((l) => {
      return l.accountId === awardData.residentId && l.achievementId === awardData.achievementId;
    });
    if (hasAlready) {
      toast.error("This resident has already been awarded this achievement.");
      return;
    }

    try {
      await awardAchievement({
        id: crypto.randomUUID(),
        recorderId: currentUserId,
        accountId: awardData.residentId,
        achievementId: awardData.achievementId,
        term: currentTerm,
        date: new Date().toISOString().split("T")[0]
      });
      toast.success("Achievement awarded");
      isAwarderOpen = false;
      awardData = { achievementId: "", residentId: "" };
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  onMount(loadData);

  let achievementOptions = $derived(
    achievements.map((a) => {
      return { value: a.id, label: a.name };
    })
  );
  let residentOptions = $derived(
    residents.map((r) => {
      return { value: r.residentId, label: r.name };
    })
  );
</script>

<div class="space-y-6">
  <SubpageHeader title="Achievements" isTopLevel={true}>
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
          onclick={() => loadData(true)}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button variant="outline" size="sm" onclick={() => (isAwarderOpen = true)} icon={UserPlus}>
          Award
        </Button>
        <Button size="sm" onclick={() => (isCreatorOpen = true)} icon={Plus}>New</Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    {#if !isGlobal}
      <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div class="w-full sm:w-64">
          <TermFilter
            onSelect={() => {
              loadData();
            }}
          />
        </div>
        <div class="flex items-center space-x-2 pb-1.5">
          <Checkbox id="admin-show-global" bind:checked={uiSettings.showGlobalAchievements} />
          <Label for="admin-show-global" class="cursor-pointer text-xs font-medium">
            Show globally earned achievements
          </Label>
        </div>
      </div>
    {/if}

    <div class="mx-auto max-w-5xl">
      <div class="flex flex-col gap-2.5">
        {#each filteredAchievements as a}
          <div>
            <AchievementCard
              achievement={a}
              percentage={calculateAchievementPercentage(
                logs.filter((l) => {
                  return l.achievementId === a.id;
                }).length,
                getEligibleCount(
                  a.term,
                  residents.filter((r) => {
                    return r.period === a.term;
                  }).length,
                  totalUsersCount
                )
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

<!-- Award Dialog -->
<Dialog.Root bind:open={isAwarderOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Award Achievement</Dialog.Title>
      <Dialog.Description
        >Select a resident to give an achievement to for the current term ({translatePeriod(
          currentTerm
        )}).</Dialog.Description
      >
    </Dialog.Header>
    <div class="space-y-4 pb-4">
      <div class="space-y-2">
        <Label>Achievement</Label>
        <Combobox
          bind:value={awardData.achievementId}
          options={achievementOptions}
          class="h-9 w-full"
        />
      </div>
      <div class="space-y-2">
        <Label>Resident</Label>
        <Combobox bind:value={awardData.residentId} options={residentOptions} class="h-9 w-full" />
      </div>
    </div>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          isAwarderOpen = false;
        }}>Cancel</Button
      >
      <Button onclick={handleAward} {isLoading} icon={UserPlus}>Award Achievement</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
