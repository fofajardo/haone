<script lang="ts">
  import * as Card from "$ui/card";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Input } from "$ui/input";
  import { TriangleAlert, ExternalLink } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import { uiSettings } from "$state/settings.svelte";
  import { PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID, PUBLIC_GS_SR_ID } from "$env/static/public";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import AppearanceSettings from "$components/AppearanceSettings.svelte";
  import VersionCard from "$components/VersionCard.svelte";
  import SettingsPreview from "$components/SettingsPreview.svelte";
  import NavSettings from "$components/residents/NavSettings.svelte";
  import PrivacySettings from "$components/residents/PrivacySettings.svelte";
  import SettingsActions from "$components/SettingsActions.svelte";
</script>

<div class="space-y-6">
  <SubpageHeader title="Settings" isTopLevel={true} />

  <div class="flex flex-col gap-8 lg:flex-row">
    <!-- Left Column: Settings -->
    <div class="flex-1 space-y-8">
      <!-- Appearance Section -->
      <AppearanceSettings />
      <NavSettings />
      <PrivacySettings />
      <SettingsActions />

      {#if uiSettings.isDev}
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
                <div class="flex gap-2">
                  <Input
                    placeholder="Enter Accounting Workbook ID (GS_AW_ID)"
                    bind:value={uiSettings.accountingWorkbookId}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!uiSettings.accountingWorkbookId}
                    href={`https://docs.google.com/spreadsheets/d/${uiSettings.accountingWorkbookId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={ExternalLink}
                  />
                </div>
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
                <div class="flex gap-2">
                  <Input
                    placeholder="Enter Resident Records ID (GS_RR_ID)"
                    bind:value={uiSettings.residentRecordsId}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!uiSettings.residentRecordsId}
                    href={`https://docs.google.com/spreadsheets/d/${uiSettings.residentRecordsId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={ExternalLink}
                  />
                </div>
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

              <div class="h-px bg-border/30"></div>

              <div class="space-y-2">
                <Label>Shared Records</Label>
                <div class="flex gap-2">
                  <Input
                    placeholder="Enter Shared Records ID (GS_SR_ID)"
                    bind:value={uiSettings.sharedRecordsId}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!uiSettings.sharedRecordsId}
                    href={`https://docs.google.com/spreadsheets/d/${uiSettings.sharedRecordsId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={ExternalLink}
                  />
                </div>
                {#if uiSettings.sharedRecordsId && uiSettings.sharedRecordsId !== PUBLIC_GS_SR_ID}
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
