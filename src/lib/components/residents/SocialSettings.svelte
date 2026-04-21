<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Shield, Trophy, LoaderCircle } from "lucide-svelte";
  import { fetchUserSettings, updateUserSettings } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { toast } from "svelte-sonner";

  let isPublic = $state(false);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let residentId = $state("");

  async function loadData() {
    if (!auth.user?.email) return;
    try {
      const [all, allUsers] = await Promise.all([fetchUserSettings(), fetchUsers()]);
      const me = allUsers.find(
        (u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase()
      );
      residentId = me?.id || "";
      const my = residentId ? all.find((s) => s.residentId === residentId) : undefined;
      isPublic = my?.isPublicAchievementList ?? false;
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  async function handleToggle(v: boolean) {
    if (!residentId) return;
    isSaving = true;
    try {
      await updateUserSettings(residentId, v);
      isPublic = v;
      toast.success("Privacy settings updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  onMount(loadData);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">Privacy</Card.Title>
    <Card.Description>Manage how your profile appears to other residents.</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-6">
    <div class="flex items-center justify-between space-x-4 rounded-lg border p-4">
      <div class="flex items-center gap-4">
        <div class="rounded-full bg-brand/10 p-2 text-brand">
          <Trophy class="h-5 w-5" />
        </div>
        <div class="space-y-0.5">
          <Label for="public-achievements" class="text-base font-bold">Public Achievements</Label>
          <p class="text-sm text-muted-foreground">
            Allow others to see your name in achievement earner lists.
          </p>
        </div>
      </div>
      {#if isLoading}
        <LoaderCircle class="h-5 w-5 animate-spin text-muted-foreground" />
      {:else}
        <Switch
          id="public-achievements"
          checked={isPublic}
          onCheckedChange={handleToggle}
          disabled={isSaving}
        />
      {/if}
    </div>
  </Card.Content>
</Card.Root>
