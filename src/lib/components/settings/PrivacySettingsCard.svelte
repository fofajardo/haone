<script lang="ts">
  import * as Card from "$ui/card";
  import { Trophy } from "@lucide/svelte";
  import { uiSettings } from "$state/settings.svelte";
  import SettingsSwitchItem from "$components/settings/SettingsSwitchItem.svelte";
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Privacy</Card.Title>
    <Card.Description>Manage your profile visibility.</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-6">
    <SettingsSwitchItem
      id="public-achievements"
      title="Public Achievements and Leaderboards"
      description="Allow others to see your name in achievement earner lists and leaderboards."
      icon={Trophy}
      bind:checked={uiSettings.isPublicAchievementList}
    />
  </Card.Content>
</Card.Root>
