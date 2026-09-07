<script lang="ts">
  import * as Card from "$ui/card";
  import { Label } from "$ui/label";
  import { Switch } from "$ui/switch";
  import { Bell, BellOff, Info, Trophy } from "@lucide/svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { notifications } from "$state/notifications.svelte";
  import { PUBLIC_VAPID_PUBLIC_KEY } from "$env/static/public";
  import { toast } from "svelte-sonner";

  async function handleToggle(checked: boolean) {
    if (checked) {
      const granted = await notifications.requestPermission();
      if (!granted) {
        toast.error("Notification permission denied");
        return;
      }

      if (!PUBLIC_VAPID_PUBLIC_KEY) {
        toast.error("Notification system not configured (VAPID key missing)");
        return;
      }

      await notifications.subscribe(PUBLIC_VAPID_PUBLIC_KEY);
    } else {
      await notifications.unsubscribe();
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Privacy & Notifications</Card.Title>
    <Card.Description>Manage your profile visibility and alert preferences.</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-6">
    <!-- Privacy Section -->
    <div class="flex items-center justify-between space-x-4 rounded-lg border p-4">
      <div class="flex items-center gap-4">
        <div class="rounded-full bg-brand/10 p-2 text-brand">
          <Trophy class="h-5 w-5" />
        </div>
        <div class="space-y-0.5">
          <Label for="public-achievements" class="text-base font-bold"
            >Public Achievements and Leaderboards</Label
          >
          <p class="text-sm text-muted-foreground">
            Allow others to see your name in achievement earner lists and leaderboards.
          </p>
        </div>
      </div>
      <Switch id="public-achievements" bind:checked={uiSettings.isPublicAchievementList} />
    </div>

    <!-- Notifications Section -->
    <div class="space-y-4">
      {#if !notifications.isSupported}
        <div
          class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200"
        >
          <Info class="mt-0.5 h-4 w-4 shrink-0" />
          <div class="text-xs leading-relaxed">
            <p class="font-bold tracking-tight uppercase">Push Not Supported</p>
            <p class="mt-1 opacity-80">
              Your browser does not support Web Push. On iOS, add this app to your Home Screen.
            </p>
          </div>
        </div>
      {/if}

      <div class="flex items-center justify-between space-x-4 rounded-lg border p-4">
        <div class="flex items-center gap-4">
          <div class="rounded-full bg-brand/10 p-2 text-brand">
            <Bell class="h-5 w-5" />
          </div>
          <div class="space-y-0.5">
            <Label class="text-base font-bold">Push Notifications</Label>
            <p class="text-sm text-muted-foreground">
              Receive real-time alerts for laundry and announcements.
            </p>
          </div>
        </div>
        <Switch
          disabled={!notifications.isSupported}
          checked={notifications.isSubscribed}
          onCheckedChange={handleToggle}
        />
      </div>

      {#if notifications.permission === "denied"}
        <p
          class="flex items-center gap-1.5 px-1 text-xs font-medium tracking-tight text-destructive uppercase"
        >
          <BellOff class="h-3.5 w-3.5" />
          Permissions denied. Enable notifications in browser settings.
        </p>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
