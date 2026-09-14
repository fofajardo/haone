<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Label } from "$ui/label";
  import {
    Monitor,
    Sun,
    Moon,
    Clock,
    Calendar,
    CalendarDays,
    CalendarRange,
    History
  } from "@lucide/svelte";
  import { settings } from "$state/settings.svelte";
  import { setMode, resetMode } from "mode-watcher";
  import SettingsSwitchItem from "$components/settings/SettingsSwitchItem.svelte";

  function updateTheme(mode: string) {
    settings.theme = mode;
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
          variant={settings.displayDensity === "compact" ? "default" : "outline"}
          class="flex h-14 flex-col gap-1"
          onclick={() => (settings.displayDensity = "compact")}
        >
          <span class="text-sm font-bold">Compact</span>
          <span class="text-xs opacity-60">Tight</span>
        </Button>
        <Button
          variant={settings.displayDensity === "default" ? "default" : "outline"}
          class="flex h-14 flex-col gap-1"
          onclick={() => (settings.displayDensity = "default")}
        >
          <span class="text-sm font-bold">Default</span>
          <span class="text-xs opacity-60">Balanced</span>
        </Button>
        <Button
          variant={settings.displayDensity === "comfortable" ? "default" : "outline"}
          class="flex h-14 flex-col gap-1"
          onclick={() => (settings.displayDensity = "comfortable")}
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
          variant={settings.fontFamily === "default" ? "default" : "outline"}
          class="flex h-14 flex-col gap-1"
          onclick={() => (settings.fontFamily = "default")}
        >
          <span class="text-sm font-bold">Default</span>
          <span class="text-xs opacity-60">Inter</span>
        </Button>
        <Button
          variant={settings.fontFamily === "archivo" ? "default" : "outline"}
          class="font-archivo flex h-14 flex-col gap-1"
          onclick={() => (settings.fontFamily = "archivo")}
        >
          <span class="text-sm font-bold">Standard</span>
          <span class="font-sans text-xs opacity-60">Archivo</span>
        </Button>
        <Button
          variant={settings.fontFamily === "shantell" ? "default" : "outline"}
          class="font-shantell flex h-14 flex-col gap-1"
          onclick={() => (settings.fontFamily = "shantell")}
        >
          <span class="text-sm font-bold">Friendly</span>
          <span class="font-sans text-xs opacity-60">Shantell Sans</span>
        </Button>
      </div>
    </div>

    <div class="h-px bg-border/50"></div>

    <!-- Theme -->
    <div class="space-y-3">
      <Label>Theme</Label>
      <div class="grid grid-cols-3 gap-2">
        <Button
          variant={settings.theme === "light" ? "default" : "outline"}
          onclick={() => updateTheme("light")}
          icon={Sun}
        >
          Light
        </Button>
        <Button
          variant={settings.theme === "dark" ? "default" : "outline"}
          onclick={() => updateTheme("dark")}
          icon={Moon}
        >
          Dark
        </Button>
        <Button
          variant={settings.theme === "system" ? "default" : "outline"}
          onclick={() => updateTheme("system")}
          icon={Monitor}
        >
          System
        </Button>
      </div>
    </div>

    <div class="h-px bg-border/50"></div>

    <!-- Motion -->
    <SettingsSwitchItem
      id="reduced-motion"
      title="Reduced Motion"
      bind:checked={settings.reducedMotion}
    />

    <div class="h-px bg-border/50"></div>

    <!-- Time Format -->
    <div class="space-y-3">
      <Label>Time Format</Label>
      <div class="grid grid-cols-2 gap-2">
        <Button
          variant={settings.clockFormat === "12h" ? "default" : "outline"}
          onclick={() => (settings.clockFormat = "12h")}
          icon={Clock}
        >
          12-hour (AM/PM)
        </Button>
        <Button
          variant={settings.clockFormat === "24h" ? "default" : "outline"}
          onclick={() => (settings.clockFormat = "24h")}
          icon={Clock}
        >
          24-hour
        </Button>
      </div>
    </div>

    <div class="h-px bg-border/50"></div>

    <div class="space-y-3">
      <Label>Default Laundry Calendar View</Label>
      <div class="grid grid-cols-2 gap-2">
        <Button
          variant={settings.calendarView === "month" ? "default" : "outline"}
          onclick={() => (settings.calendarView = "month")}
          icon={CalendarRange}
        >
          Month
        </Button>
        <Button
          variant={settings.calendarView === "week" ? "default" : "outline"}
          onclick={() => (settings.calendarView = "week")}
          icon={CalendarDays}
        >
          Week
        </Button>
        <Button
          variant={settings.calendarView === "day" ? "default" : "outline"}
          onclick={() => (settings.calendarView = "day")}
          icon={Calendar}
        >
          Day
        </Button>
        <Button
          variant={settings.calendarView === "history" ? "default" : "outline"}
          onclick={() => (settings.calendarView = "history")}
          icon={History}
        >
          History
        </Button>
      </div>
    </div>
  </Card.Content>
</Card.Root>
