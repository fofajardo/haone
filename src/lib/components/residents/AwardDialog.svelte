<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import { Button } from "$ui/button";
  import { auth } from "$state/auth.svelte";
  import { fetchAchievements, awardAchievementBatch } from "$logic/admin-logic";
  import { fetchUsers } from "$logic/resident-logic";
  import type { ResidentRecord, AchievementRecord } from "$lib/types";
  import { pluralize } from "$utils/formatters";
  import { X, Trophy } from "@lucide/svelte";
  import { Combobox } from "$ui/combobox";
  import { Label } from "$ui/label";
  import { toast } from "svelte-sonner";

  let {
    open = $bindable(false),
    residents = [],
    onSuccess
  } = $props<{
    open: boolean;
    residents: ResidentRecord[];
    onSuccess?: (count: number) => void;
  }>();

  let isLoading = $state(false);
  let isAwarding = $state(false);
  let achievements = $state<AchievementRecord[]>([]);
  let selectedAchievementId = $state("");
  let currentUserId = $state("");

  async function loadData() {
    isLoading = true;
    try {
      const [achList, userList] = await Promise.all([fetchAchievements(true), fetchUsers()]);
      achievements = achList;
      const me = userList.find((u) => {
        return u.email.toLowerCase() === (auth.user?.email || "").toLowerCase();
      });
      currentUserId = me?.id || "";
    } catch (e: any) {
      console.error("Failed to load achievements data:", e);
      toast.error("Failed to load achievements: " + e.message);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (open) {
      loadData();
      selectedAchievementId = "";
    }
  });

  let achievementOptions = $derived(
    achievements.map((a) => {
      return { value: a.id, label: `${a.icon || "🏆"} ${a.name}` };
    })
  );

  async function handleConfirm() {
    if (!selectedAchievementId) {
      toast.error("Please select an achievement to award");
      return;
    }
    if (residents.length === 0) {
      return;
    }

    isAwarding = true;
    try {
      const recordsToAward = residents
        .filter((r: ResidentRecord) => {
          return r.residentId && r.residentId !== "";
        })
        .map((r: ResidentRecord) => {
          return {
            id: crypto.randomUUID(),
            recorderId: currentUserId,
            accountId: r.residentId,
            achievementId: selectedAchievementId,
            date: new Date().toISOString().split("T")[0]
          };
        });

      if (recordsToAward.length === 0) {
        toast.error("No valid residents found with registered accounts.");
        isAwarding = false;
        return;
      }

      await awardAchievementBatch(recordsToAward);
      toast.success(
        `Awarded achievement to ${pluralize(recordsToAward.length, "resident", "residents")}`
      );
      open = false;
      if (onSuccess) {
        onSuccess(recordsToAward.length);
      }
    } catch (e: any) {
      console.error("Awarding error:", e);
      toast.error("Failed to award achievement: " + e.message);
    } finally {
      isAwarding = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Award Achievement</Dialog.Title>
      <Dialog.Description>
        Select an achievement to award to the {pluralize(
          residents.length,
          "selected resident",
          "selected residents"
        )}.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label>Achievement</Label>
        {#if isLoading}
          <div class="animate-pulse text-xs text-muted-foreground">Loading achievements…</div>
        {:else}
          <Combobox
            bind:value={selectedAchievementId}
            options={achievementOptions}
            class="w-full"
            placeholder="Select an achievement…"
          />
        {/if}
      </div>
    </div>

    <Dialog.Footer class="mt-4">
      <Button
        variant="outline"
        onclick={() => {
          open = false;
        }}
        icon={X}>Cancel</Button
      >
      <Button
        onclick={handleConfirm}
        isLoading={isAwarding}
        disabled={isAwarding || isLoading || !selectedAchievementId}
        icon={Trophy}
      >
        Award
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
