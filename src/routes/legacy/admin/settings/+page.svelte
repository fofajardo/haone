<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Switch } from "$lib/components/ui/switch";
  import { Input } from "$lib/components/ui/input";
  import { Monitor, Sun, Moon, CircleCheckBig, TriangleAlert } from "lucide-svelte";
  import branding from "$lib/branding.json";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { setMode, resetMode, userPrefersMode } from "mode-watcher";

  const brandingProfiles = Object.keys(branding);
</script>

<div class="space-y-6">
  <div class="flex items-center gap-2">
    <h1 class="text-3xl font-bold tracking-tight">Settings</h1>
  </div>

  <div class="flex flex-col gap-8 lg:flex-row">
    <!-- Left Column: Settings -->
    <div class="flex-1 space-y-8">
      <!-- Appearance Section -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Appearance</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-6">
          <!-- Density -->
          <div class="space-y-3">
            <Label>Density</Label>
            <div class="grid grid-cols-3 gap-2">
              <Button
                variant={uiSettings.displayDensity === "compact" ? "default" : "outline"}
                class="flex h-14 flex-col gap-1"
                onclick={() => (uiSettings.displayDensity = "compact")}
              >
                <span class="text-sm font-bold">Compact</span>
                <span class="text-[9px] opacity-60">Tight</span>
              </Button>
              <Button
                variant={uiSettings.displayDensity === "default" ? "default" : "outline"}
                class="flex h-14 flex-col gap-1"
                onclick={() => (uiSettings.displayDensity = "default")}
              >
                <span class="text-sm font-bold">Default</span>
                <span class="text-[9px] opacity-60">Balanced</span>
              </Button>
              <Button
                variant={uiSettings.displayDensity === "comfortable" ? "default" : "outline"}
                class="flex h-14 flex-col gap-1"
                onclick={() => (uiSettings.displayDensity = "comfortable")}
              >
                <span class="text-sm font-bold">Comfortable</span>
                <span class="text-[9px] opacity-60">Open</span>
              </Button>
            </div>
          </div>

          <div class="h-px bg-border/50"></div>

          <!-- Typography -->
          <div class="space-y-3">
            <Label>Typography</Label>
            <div class="grid grid-cols-3 gap-2">
              <Button
                variant={uiSettings.fontFamily === "inter" ? "default" : "outline"}
                class="flex h-14 flex-col gap-1"
                onclick={() => (uiSettings.fontFamily = "inter")}
              >
                <span class="text-sm font-bold">Default</span>
                <span class="text-[9px] opacity-60">Inter Sans</span>
              </Button>
              <Button
                variant={uiSettings.fontFamily === "archivo" ? "default" : "outline"}
                class="font-archivo flex h-14 flex-col gap-1"
                onclick={() => (uiSettings.fontFamily = "archivo")}
              >
                <span class="text-sm font-bold">Standard</span>
                <span class="font-sans text-[9px] opacity-60">Archivo</span>
              </Button>
              <Button
                variant={uiSettings.fontFamily === "shantell" ? "default" : "outline"}
                class="font-shantell flex h-14 flex-col gap-1"
                onclick={() => (uiSettings.fontFamily = "shantell")}
              >
                <span class="text-sm font-bold">Friendly</span>
                <span class="font-sans text-[9px] opacity-60">Shantell</span>
              </Button>
            </div>
          </div>

          <div class="h-px bg-border/50"></div>

          <!-- Theme -->
          <div class="space-y-3">
            <Label>Theme</Label>
            <div class="grid grid-cols-3 gap-2">
              <Button
                variant={userPrefersMode.current === "light" ? "default" : "outline"}
                class="h-10 gap-2"
                onclick={() => setMode("light")}
              >
                <Sun class="h-4 w-4" />
                <span class="text-xs">Light</span>
              </Button>
              <Button
                variant={userPrefersMode.current === "dark" ? "default" : "outline"}
                class="h-10 gap-2"
                onclick={() => setMode("dark")}
              >
                <Moon class="h-4 w-4" />
                <span class="text-xs">Dark</span>
              </Button>
              <Button
                variant={userPrefersMode.current === "system" ? "default" : "outline"}
                class="h-10 gap-2"
                onclick={() => resetMode()}
              >
                <Monitor class="h-4 w-4" />
                <span class="text-xs">System</span>
              </Button>
            </div>
          </div>

          <div class="h-px bg-border/50"></div>

          <!-- Motion -->
          <div class="flex items-center justify-between">
            <Label>Reduced Motion</Label>
            <Switch bind:checked={uiSettings.reducedMotion} />
          </div>
        </Card.Content>
      </Card.Root>

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
              <NativeSelect.Root bind:value={brandingState.selectedKey} class="h-10 w-full">
                {#each brandingProfiles as key}
                  <NativeSelect.Option value={key}
                    >{(branding as any)[key].name}</NativeSelect.Option
                  >
                {/each}
              </NativeSelect.Root>
            </div>
            <div class="space-y-2">
              <Label>Google Spreadsheet ID</Label>
              <Input
                placeholder="Enter Spreadsheet ID (from URL)"
                bind:value={brandingState.spreadsheetId}
              />
              {#if brandingState.spreadsheetId && brandingState.spreadsheetId !== (branding as any)[brandingState.selectedKey].spreadsheetId}
                <div
                  class="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-[10px] text-amber-600"
                >
                  <TriangleAlert class="h-3.5 w-3.5" />
                  <span
                    >Manual override active. This will target a different sheet than the
                    organization default.</span
                  >
                </div>
              {/if}
              <p class="text-[10px] text-muted-foreground italic">
                Found in the sheet URL: docs.google.com/spreadsheets/d/<b>ID_HERE</b>/edit
              </p>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- About Section -->
      <Card.Root class="overflow-hidden">
        <Card.Content>
          <div class="flex flex-col gap-6">
            <div class="flex items-center gap-2.5">
              <img src="/ha1.svg" alt="HAOne" class="h-10 w-10" />
              <span class="text-3xl font-bold tracking-tighter text-foreground">HAOne</span>
            </div>

            <div class="space-y-4">
              <div
                class="flex flex-col items-start gap-4 text-[11px] font-semibold text-foreground sm:flex-row sm:items-center sm:gap-x-8 sm:gap-y-2"
              >
                <div class="flex items-center gap-2">
                  <span class="tracking-widest uppercase">Version</span>
                  <code class="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                    >v{__APP_VERSION__}</code
                  >
                </div>
                <div class="flex items-center gap-2 sm:border-l sm:border-border/50 sm:pl-8">
                  <span class="tracking-widest uppercase">Build</span>
                  <code class="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                    >{__COMMIT_SHA__}</code
                  >
                </div>
                <div class="flex items-center gap-2 sm:border-l sm:border-border/50 sm:pl-8">
                  <span class="tracking-widest uppercase">License</span>
                  <code class="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                    >MPL-2.0</code
                  >
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <div class="flex items-center gap-2 px-1 text-[10px] font-medium text-muted-foreground/60">
        <CircleCheckBig class="h-3.5 w-3.5 text-green-600/50" />
        Settings persist in this browser.
      </div>
    </div>

    <!-- Right Column: Live Preview Sandbox -->
    <div class="w-full space-y-4 lg:w-[400px]">
      <div class="sticky top-8 space-y-4">
        <p class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
          Live Preview Sandbox
        </p>
        <div
          class="rounded-2xl border bg-card p-8 shadow-sm transition-all {uiSettings.displayDensity !==
          'default'
            ? `acc-density-${uiSettings.displayDensity}`
            : ''}"
          data-slot="sandbox"
          class:font-sans={uiSettings.fontFamily === "inter"}
          class:font-archivo={uiSettings.fontFamily === "archivo"}
          class:font-shantell={uiSettings.fontFamily === "shantell"}
          class:acc-reduced-motion={uiSettings.reducedMotion}
        >
          <div class="flex flex-col items-center gap-6 text-center">
            <img src={brandingState.profile.logoUrl} alt="Logo" class="h-16 w-auto grayscale-0" />
            <div class="w-full space-y-4">
              <div class="space-y-1">
                <h3 class="text-lg font-bold text-foreground">
                  {brandingState.profile.issuerName}
                </h3>
                <p class="text-xs text-muted-foreground">Electronic Receipt #88219</p>
              </div>

              <div class="h-px w-full bg-border"></div>

              <div class="space-y-2 text-left">
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground">Water Fee</span>
                  <span class="font-bold">24,500.00</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-muted-foreground">Association Fee</span>
                  <span class="font-bold">1,200.00</span>
                </div>
                <div class="flex justify-between border-t pt-2 font-bold">
                  <span>TOTAL</span>
                  <span>₱25,700.00</span>
                </div>
              </div>

              <div class="rounded-lg bg-muted/50 p-4 text-[10px] text-muted-foreground italic">
                This is a reactive preview showing current branding, typography, and density
                settings.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
