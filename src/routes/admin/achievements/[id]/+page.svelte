<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Pencil, Share2 } from "@lucide/svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import * as Dialog from "$ui/dialog";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Textarea } from "$ui/textarea";
  import { Checkbox } from "$ui/checkbox";
  import TermFilter from "$components/TermFilter.svelte";
  import { toast } from "svelte-sonner";
  import {
    fetchAdminAchievements,
    fetchAchievementLogs,
    updateAchievement
  } from "$api/controllers/achievement-controller";
  import { fetchUsers, fetchResidents } from "$api/controllers/resident-controller";
  import type { AchievementRecord } from "$lib/types";
  import AchievementDetailsView from "$components/achievements/AchievementDetailsView.svelte";
  import { shareAchievementStory } from "$components/achievements/story-share";

  const id = page.params.id;

  let achievement = $state<AchievementRecord | null>(null);
  let earners = $state<{ residentId: string; name: string; date: string; isPublic: boolean }[]>([]);
  let isAdmin = $state(true);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let isSharingStory = $state(false);
  let error = $state<string | null>(null);
  let isEditorOpen = $state(false);

  async function handleShareStory() {
    if (!achievement) {
      return;
    }
    isSharingStory = true;
    try {
      await shareAchievementStory(achievement);
    } catch (e) {
      console.error(e);
      toast.error("Could not prepare the story image");
    } finally {
      isSharingStory = false;
    }
  }

  interface EditState {
    id: string;
    name: string;
    description: string;
    icon: string;
    extraUrl: string;
    points: number;
    term: string;
    creatorId: string;
    isIndefinite: boolean;
  }

  let editData = $state<EditState>({
    id: "",
    name: "",
    description: "",
    icon: "🏆",
    extraUrl: "",
    points: 10,
    term: "",
    creatorId: "",
    isIndefinite: false
  });

  function openEditor() {
    if (!achievement) {
      return;
    }
    editData = {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      extraUrl: achievement.extraUrl,
      points: achievement.points || 0,
      term: achievement.term || "",
      creatorId: achievement.creatorId,
      isIndefinite: !achievement.term
    };
    isEditorOpen = true;
  }

  async function handleUpdate() {
    isSaving = true;
    try {
      await updateAchievement(editData.id, {
        creatorId: editData.creatorId,
        name: editData.name,
        description: editData.description,
        icon: editData.icon,
        extraUrl: editData.extraUrl,
        points: Number(editData.points) || 0,
        term: editData.isIndefinite ? "" : editData.term
      });
      toast.success("Achievement updated");
      isEditorOpen = false;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const [allA, allL, allU, allR] = await Promise.all([
        fetchAdminAchievements(bypassCache),
        fetchAchievementLogs(bypassCache),
        fetchUsers(bypassCache),
        fetchResidents(bypassCache)
      ]);

      const foundA =
        allA.find((a) => {
          return a.id === id;
        }) || null;
      if (!foundA) {
        throw new Error("Achievement not found");
      }

      const eligibleCount = foundA.term
        ? allR.filter((r) => {
            return r.period === foundA.term;
          }).length
        : allU.length;

      achievement = {
        ...foundA,
        totalEligibleCount: eligibleCount
      };

      const achievementLogs = allL.filter((l) => {
        return l.achievementId === id;
      });

      const userMap = new Map();
      allU.forEach((u) => {
        userMap.set(u.id, u.displayName || "Resident");
      });

      earners = achievementLogs.map((l) => {
        return {
          residentId: l.accountId,
          name: userMap.get(l.accountId) || "Resident",
          date: l.date,
          isPublic: true
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

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Achievement Details"
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
    actions={[
      ...(achievement
        ? [
            {
              label: "Share Story",
              icon: Share2,
              variant: "outline" as const,
              isLoading: isSharingStory,
              onclick: handleShareStory
            },
            {
              label: "Edit",
              icon: Pencil,
              onclick: openEditor
            }
          ]
        : [])
    ]}
  />

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
  {:else if achievement}
    <AchievementDetailsView {achievement} {earners} {isAdmin} />
  {/if}
</div>

<Dialog.Root bind:open={isEditorOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Edit Achievement</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <div class="grid grid-cols-4 gap-4">
        <div class="space-y-2">
          <Label for="edit-icon">Icon/Emoji</Label>
          <Input id="edit-icon" bind:value={editData.icon} />
        </div>
        <div class="col-span-3 space-y-2">
          <Label for="edit-name">Name</Label>
          <Input id="edit-name" bind:value={editData.name} />
        </div>
      </div>
      <div class="space-y-2">
        <Label for="edit-desc">Description</Label>
        <Textarea id="edit-desc" bind:value={editData.description} />
      </div>
      <div class="space-y-2">
        <Label for="edit-url">Extra URL (optional)</Label>
        <Input id="edit-url" bind:value={editData.extraUrl} placeholder="https://..." />
      </div>
      <div class="space-y-2">
        <Label for="edit-points">XP</Label>
        <Input id="edit-points" type="number" min="0" bind:value={editData.points} />
      </div>
      <div class="flex items-center space-x-2 py-2">
        <Checkbox id="edit-is-indefinite" bind:checked={editData.isIndefinite} />
        <Label for="edit-is-indefinite" class="cursor-pointer text-sm leading-none font-medium"
          >Indefinite unlocking period</Label
        >
      </div>
      {#if !editData.isIndefinite}
        <div class="animate-in space-y-2 duration-200 fade-in-50">
          <TermFilter bind:value={editData.term} />
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => {
          isEditorOpen = false;
        }}>Cancel</Button
      >
      <Button onclick={handleUpdate} isLoading={isSaving}>Save Changes</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
