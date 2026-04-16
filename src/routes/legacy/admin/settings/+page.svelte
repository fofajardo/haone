<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import { CheckCircle2 } from "lucide-svelte";
  import branding from "$lib/branding.json";
  import { brandingState, type BrandingKey } from "$lib/branding.svelte";

  const brandingProfiles = Object.keys(branding);
</script>

<div class="space-y-6">
  <div class="flex items-center gap-2">
    <h1 class="text-3xl font-bold tracking-tight">Settings</h1>
  </div>

  <div class="grid gap-6 md:grid-cols-2">
    <Card.Root>
      <Card.Header>
        <Card.Title>Application Branding</Card.Title>
        <Card.Description>
          Select the active branding profile for all management tools.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="space-y-2">
          <Label for="branding">Active Profile</Label>
          <Select.Root type="single" bind:value={brandingState.selectedKey}>
            <Select.Trigger class="w-full">
              {brandingState.profile.name}
            </Select.Trigger>
            <Select.Content>
              {#each brandingProfiles as key}
                <Select.Item value={key} label={(branding as any)[key].name}>
                  {(branding as any)[key].name}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="space-y-4 rounded-xl border bg-muted/30 p-6">
          <p class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
            Preview
          </p>
          <div class="flex flex-col items-center gap-4 text-center">
            <img
              src={brandingState.profile.logoUrl}
              alt="Logo Preview"
              class="h-20 w-auto object-contain"
            />
            <div class="space-y-1">
              <p class="text-sm font-bold text-slate-800">{brandingState.profile.issuerName}</p>
              <p class="text-xs text-muted-foreground italic">{brandingState.profile.replyTo}</p>
            </div>
          </div>
        </div>
      </Card.Content>
      <Card.Footer class="border-t bg-muted/10 px-6 py-4">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CheckCircle2 class="h-4 w-4 text-green-600" />
          Settings are saved automatically for this device.
        </div>
      </Card.Footer>
    </Card.Root>
  </div>
</div>
