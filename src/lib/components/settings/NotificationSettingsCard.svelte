<script lang="ts">
  import * as Card from "$ui/card";
  import { Bell, TriangleAlert } from "@lucide/svelte";
  import { notifications } from "$state/notifications.svelte";
  import { PUBLIC_VAPID_PUBLIC_KEY } from "$env/static/public";
  import { toast } from "svelte-sonner";
  import SettingsSwitchItem from "$components/settings/SettingsSwitchItem.svelte";

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
    <Card.Title>Notifications</Card.Title>
    <Card.Description>Manage your alert preferences.</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-6">
    <div class="space-y-4">
      {#if !notifications.isSupported}
        <div
          class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200"
        >
          <TriangleAlert class="mt-1 h-4 w-4 shrink-0" />
          <div class="space-y-2 text-sm leading-relaxed">
            <p>Your browser does not support receiving push notifications.</p>
            <p>On iOS, add this app to your Home Screen.</p>
          </div>
        </div>
      {:else}
        <SettingsSwitchItem
          title="Allow push notifications"
          description="Receive alerts for laundry and announcements."
          icon={Bell}
          disabled={!notifications.isSupported}
          checked={notifications.isSubscribed}
          onCheckedChange={handleToggle}
        />

        {#if notifications.permission === "denied"}
          <div
            class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200"
          >
            <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="text-sm leading-relaxed">
              <p>Permission denied. Please enable notifications in browser settings.</p>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </Card.Content>
</Card.Root>
