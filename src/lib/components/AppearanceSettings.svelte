<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Monitor, Sun, Moon } from "lucide-svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { setMode, resetMode } from "mode-watcher";

  function updateTheme(mode: string) {
    uiSettings.theme = mode;
    if (mode === "system") resetMode();
    else setMode(mode as any);
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Appearance</Card.Title>
    <Card.Description>Customize how the dashboard looks and feels.</Card.Description>
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
          <span class="text-xs opacity-60">Tight</span>
        </Button>
        <Button
          variant={uiSettings.displayDensity === "default" ? "default" : "outline"}
          class="flex h-14 flex-col gap-1"
          onclick={() => (uiSettings.displayDensity = "default")}
        >
          <span class="text-sm font-bold">Default</span>
          <span class="text-xs opacity-60">Balanced</span>
        </Button>
        <Button
          variant={uiSettings.displayDensity === "comfortable" ? "default" : "outline"}
          class="flex h-14 flex-col gap-1"
          onclick={() => (uiSettings.displayDensity = "comfortable")}
        >
          <span class="text-sm font-bold">Comfortable</span>
          <span class="text-xs opacity-60">Open</span>
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
          <span class="text-xs opacity-60">Inter Sans</span>
        </Button>
        <Button
          variant={uiSettings.fontFamily === "archivo" ? "default" : "outline"}
          class="font-archivo flex h-14 flex-col gap-1"
          onclick={() => (uiSettings.fontFamily = "archivo")}
        >
          <span class="text-sm font-bold">Standard</span>
          <span class="font-sans text-xs opacity-60">Archivo</span>
        </Button>
        <Button
          variant={uiSettings.fontFamily === "shantell" ? "default" : "outline"}
          class="font-shantell flex h-14 flex-col gap-1"
          onclick={() => (uiSettings.fontFamily = "shantell")}
        >
          <span class="text-sm font-bold">Friendly</span>
          <span class="font-sans text-xs opacity-60">Shantell</span>
        </Button>
      </div>
    </div>

    <div class="h-px bg-border/50"></div>

    <!-- Theme -->
    <div class="space-y-3">
      <Label>Theme</Label>
      <div class="grid grid-cols-3 gap-2">
        <Button
          variant={uiSettings.theme === "light" ? "default" : "outline"}
          class="h-10"
          onclick={() => updateTheme("light")}
          icon={Sun}
        >
          Light
        </Button>
        <Button
          variant={uiSettings.theme === "dark" ? "default" : "outline"}
          class="h-10"
          onclick={() => updateTheme("dark")}
          icon={Moon}
        >
          Dark
        </Button>
        <Button
          variant={uiSettings.theme === "system" ? "default" : "outline"}
          class="h-10"
          onclick={() => updateTheme("system")}
          icon={Monitor}
        >
          System
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
