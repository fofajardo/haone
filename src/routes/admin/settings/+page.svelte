<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Input } from "$lib/components/ui/input";
  import { TriangleAlert } from "lucide-svelte";
  import branding from "$lib/branding.json";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID } from "$env/static/public";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import AppearanceSettings from "$lib/components/AppearanceSettings.svelte";
  import VersionCard from "$lib/components/VersionCard.svelte";
  import SettingsPreview from "$lib/components/SettingsPreview.svelte";

  const brandingProfiles = Object.keys(branding);
</script>

<div class="space-y-6">
  <SubpageHeader title="Settings" isTopLevel={true} />

  <div class="flex flex-col gap-8 lg:flex-row">
    <!-- Left Column: Settings -->
    <div class="flex-1 space-y-8">
      <!-- Appearance Section -->
      <AppearanceSettings />

      {#if uiSettings.isDev}
        <!-- Branding Section -->
        <Card.Root>
          <Card.Header>
            <Card.Title>Application Branding</Card.Title>
            <Card.Description>Select the active profile for tools and reports.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div class="space-y-4">
              <div class="space-y-2">
                <Label for="branding">Active Profile</Label>
                <Combobox
                  bind:value={brandingState.selectedKey}
                  options={brandingProfiles.map((key) => ({
                    value: key,
                    label: (branding as any)[key].name
                  }))}
                  class="h-10 w-full"
                />
              </div>
            </div>
          </Card.Content>
        </Card.Root>

        <!-- Development Configuration -->
        <Card.Root>
          <Card.Header>
            <Card.Title>Development Configuration</Card.Title>
            <Card.Description
              >Manage spreadsheet IDs overrides for testing. <p
                class="mt-2 text-xs text-muted-foreground italic"
              >
                Found in the sheet URL: docs.google.com/spreadsheets/d/<b>ID_HERE</b>/edit
              </p>
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div class="space-y-4">
              <div class="space-y-2">
                <Label>Accounting Workbook</Label>
                <Input
                  placeholder="Enter Accounting Workbook ID (GS_AW_ID)"
                  bind:value={uiSettings.accountingWorkbookId}
                />
                {#if uiSettings.accountingWorkbookId && uiSettings.accountingWorkbookId !== PUBLIC_GS_AW_ID}
                  <div
                    class="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-600"
                  >
                    <TriangleAlert class="h-3.5 w-3.5" />
                    <span
                      >Manual override active. This will target a different sheet than the
                      organization default.</span
                    >
                  </div>
                {/if}
              </div>

              <div class="h-px bg-border/30"></div>

              <div class="space-y-2">
                <Label>Resident Records</Label>
                <Input
                  placeholder="Enter Resident Records ID (GS_RR_ID)"
                  bind:value={uiSettings.residentRecordsId}
                />
                {#if uiSettings.residentRecordsId && uiSettings.residentRecordsId !== PUBLIC_GS_RR_ID}
                  <div
                    class="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-600"
                  >
                    <TriangleAlert class="h-3.5 w-3.5" />
                    <span
                      >Manual override active. This will target a different sheet than the
                      organization default.</span
                    >
                  </div>
                {/if}
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}

      <VersionCard />
    </div>

    <SettingsPreview />
  </div>
</div>
