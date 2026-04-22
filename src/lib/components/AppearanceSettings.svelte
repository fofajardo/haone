<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Monitor, Sun, Moon, LoaderCircle } from "lucide-svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { setMode, resetMode, userPrefersMode } from "mode-watcher";
  import { auth } from "$lib/auth.svelte";
  import { fetchUsers } from "$lib/resident-logic";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  let isSaving = $state(false);
  let residentId = $state("");

  async function handleSave() {
    isSaving = true;
    try {
      const id = residentId || auth.user?.email || "";
      await uiSettings.syncToServer(id);
      toast.success("Appearance saved to account");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  function updateTheme(mode: string) {
    uiSettings.theme = mode;
    if (mode === "system") resetMode();
    else setMode(mode as any);
  }

  onMount(async () => {
    if (auth.authType === "admin") {
      const users = await fetchUsers();
      const me = users.find(
        (u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase()
      );
      residentId = me?.id || "";
    }
  });
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
          class="h-10 gap-2"
          onclick={() => updateTheme("light")}
        >
          <Sun class="h-4 w-4" />
          <span class="text-xs">Light</span>
        </Button>
        <Button
          variant={uiSettings.theme === "dark" ? "default" : "outline"}
          class="h-10 gap-2"
          onclick={() => updateTheme("dark")}
        >
          <Moon class="h-4 w-4" />
          <span class="text-xs">Dark</span>
        </Button>
        <Button
          variant={uiSettings.theme === "system" ? "default" : "outline"}
          class="h-10 gap-2"
          onclick={() => updateTheme("system")}
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
  <Card.Footer class="flex justify-between border-t bg-muted/20">
    <p class="text-xs text-muted-foreground">Changes will follow your account.</p>
    <Button size="sm" onclick={handleSave} disabled={isSaving}>
      {#if isSaving}
        <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
      {/if}
      Save
    </Button>
  </Card.Footer>
</Card.Root>
