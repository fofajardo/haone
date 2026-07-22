<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/state/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, Trophy, UserPlus } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import {
    fetchAchievements,
    fetchAchievementLogs,
    addAchievement,
    awardAchievement
  } from "$lib/logic/admin-logic";
  import { fetchResidents, fetchTermCurr, fetchUsers } from "$lib/logic/resident-logic";
  import type { AchievementLogRecord, AchievementRecord } from "$lib/schemas";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import { toast } from "svelte-sonner";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { translatePeriod } from "$lib/utils/translators";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { uiSettings } from "$lib/state/settings.svelte";
  import {
    calculateAchievementPercentage,
    getEligibleCount
  } from "$lib/logic/shared-records-logic";
  import AchievementCard from "$lib/components/achievements/AchievementCard.svelte";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let residents = $state<any[]>([]);
  let currentTerm = $state("");
  let currentUserId = $state("");
  let totalUsersCount = $state(0);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

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
      return !a.term || a.term === uiSettings.currentTerm;
    })
  );

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [a, l, r, t, allU] = await Promise.all([
        fetchAchievements(true),
        fetchAchievementLogs(true),
        fetchResidents(true),
        fetchTermCurr(true),
        fetchUsers(true)
      ]);
      achievements = a;
      logs = l;
      currentTerm = t;
      totalUsersCount = allU.length;
      if (!uiSettings.currentTerm) {
        uiSettings.currentTerm = t;
      }
      residents = r.filter((res) => {
        return res.period === (uiSettings.currentTerm || t);
      });
      if (!newAchievement.term) {
        newAchievement.term = uiSettings.currentTerm || t;
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
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData()}
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
    <div class="grid gap-2 lg:grid-cols-12 mb-4">
      <div class="lg:col-span-3">
        <TermFilter
          onSelect={() => {
            loadData();
          }}
        />
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredAchievements as a}
        <div class="h-full">
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
            earnersCount={logs.filter((l) => {
              return l.achievementId === a.id;
            }).length}
            href="/admin/achievements/{a.id}"
          />
        </div>
      {:else}
        <EmptyView
          title="No achievements defined."
          description="Achievements created by admins will appear here."
          class="col-span-full"
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
        <Label for="is-indefinite" class="text-sm font-medium leading-none cursor-pointer"
          >Indefinite unlocking period</Label
        >
      </div>
      {#if !newAchievement.isIndefinite}
        <div class="space-y-2 animate-in fade-in-50 duration-200">
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
