<script lang="ts">
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import AppearanceSettings from "$lib/components/AppearanceSettings.svelte";
  import VersionCard from "$lib/components/VersionCard.svelte";
  import SettingsPreview from "$lib/components/SettingsPreview.svelte";
  import SocialSettings from "$lib/components/residents/SocialSettings.svelte";
  import NavSettings from "$lib/components/residents/NavSettings.svelte";
  import { onMount } from "svelte";
  import { pageState } from "$lib/page-info.svelte";

  onMount(() => {
    pageState.title = "Settings";
  });
</script>

<div class="space-y-6">
  <SubpageHeader title="Settings" isTopLevel={true} />

  <div class="flex flex-col gap-8 lg:flex-row">
    <div class="flex-1 space-y-8">
      <AppearanceSettings />
      <NavSettings />
      <SocialSettings />
      <VersionCard />
    </div>

    <SettingsPreview />
  </div>
</div>
