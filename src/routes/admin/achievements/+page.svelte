<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, Trophy, UserPlus, Search } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import {
    fetchAchievements,
    fetchAchievementLogs,
    addAchievement,
    awardAchievement
  } from "$lib/admin-logic";
  import { fetchResidents, fetchTermCurr, fetchUsers } from "$lib/resident-logic";
  import type { AchievementRecord, AchievementLogRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import { toast } from "svelte-sonner";
  import { Combobox } from "$lib/components/ui/combobox";

  let achievements = $state<AchievementRecord[]>([]);
  let logs = $state<AchievementLogRecord[]>([]);
  let residents = $state<any[]>([]);
  let currentTerm = $state("");
  let currentUserId = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let isCreatorOpen = $state(false);
  let isAwarderOpen = $state(false);

  let newAchievement = $state({
    name: "",
    description: "",
    icon: "🏆",
    extraUrl: ""
  });

  let awardData = $state({
    achievementId: "",
    residentId: ""
  });

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
      residents = r.filter((res) => res.period === t);
      currentTerm = t;
      const me = allU.find((u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase());
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
        ...newAchievement
      });
      toast.success("Achievement created");
      isCreatorOpen = false;
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
    try {
      await awardAchievement({
        id: crypto.randomUUID(),
        recorderId: currentUserId,
        accountId: awardData.residentId,
        achievementId: awardData.achievementId,
        date: new Date().toISOString().split("T")[0]
      });
      toast.success("Achievement awarded");
      isAwarderOpen = false;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  onMount(loadData);

  let achievementOptions = $derived(achievements.map((a) => ({ value: a.id, label: a.name })));
  let residentOptions = $derived(residents.map((r) => ({ value: r.residentId, label: r.name })));
</script>

<div class="space-y-6">
  <SubpageHeader title="Achievements" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData()} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
        </Button>
        <Button variant="outline" size="sm" onclick={() => (isAwarderOpen = true)}>
          <UserPlus class="mr-2 h-4 w-4" /> Award
        </Button>
        <Button size="sm" onclick={() => (isCreatorOpen = true)}>
          <Plus class="mr-2 h-4 w-4" /> New Achievement
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading achievements…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each achievements as a}
        <Card.Root>
          <Card.Header>
            <div class="flex items-center justify-between">
              <div class="text-4xl">{a.icon || "🏆"}</div>
              <div
                class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand uppercase"
              >
                {logs.filter((l) => l.achievementId === a.id).length} Earned
              </div>
            </div>
            <Card.Title class="mt-4">{a.name}</Card.Title>
            <Card.Description class="line-clamp-2">{a.description}</Card.Description>
          </Card.Header>
          {#if a.extraUrl}
            <Card.Footer>
              <a
                href={a.extraUrl}
                target="_blank"
                class="truncate text-xs text-blue-500 hover:underline">Learn More</a
              >
            </Card.Footer>
          {/if}
        </Card.Root>
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
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (isCreatorOpen = false)}>Cancel</Button>
      <Button onclick={handleCreate}>Create</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={isAwarderOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Award Achievement</Dialog.Title>
      <Dialog.Description
        >Select a resident to give an achievement to for the current term ({currentTerm}).</Dialog.Description
      >
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label>Achievement</Label>
        <Combobox
          bind:value={awardData.achievementId}
          options={achievementOptions}
          class="h-10 w-full"
        />
      </div>
      <div class="space-y-2">
        <Label>Resident</Label>
        <Combobox bind:value={awardData.residentId} options={residentOptions} class="h-10 w-full" />
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (isAwarderOpen = false)}>Cancel</Button>
      <Button onclick={handleAward}>Award Achievement</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
