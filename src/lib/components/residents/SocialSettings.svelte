<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Trophy } from "lucide-svelte";
  import { uiSettings } from "$lib/settings.svelte";
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
      <Switch
        id="public-achievements"
        bind:checked={uiSettings.isPublicAchievementList}
      />
    </div>
  </Card.Content>
</Card.Root>
