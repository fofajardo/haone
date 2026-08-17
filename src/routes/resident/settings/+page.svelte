<script lang="ts">
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import AppearanceSettings from "$components/AppearanceSettings.svelte";
  import VersionCard from "$components/VersionCard.svelte";
  import SettingsPreview from "$components/SettingsPreview.svelte";
  import NavSettings from "$components/residents/NavSettings.svelte";
  import PrivacySettings from "$components/residents/PrivacySettings.svelte";
  import SettingsActions from "$components/SettingsActions.svelte";
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";

  onMount(() => {
    pageState.title = "Settings";
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <SubpageHeader title="Settings" isTopLevel={true} />

  <div class="flex flex-col gap-8 lg:flex-row">
    <div class="flex-1 space-y-8">
      <AppearanceSettings />
      <NavSettings />
      <PrivacySettings />
      <SettingsActions />
      <VersionCard />
    </div>

    <SettingsPreview />
  </div>
</div>
