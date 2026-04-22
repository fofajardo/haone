<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import {
    LayoutDashboard,
    Wallet,
    House,
    WashingMachine,
    Banknote,
    Megaphone,
    Trophy,
    Receipt,
    History,
    Users,
    Bed,
    Contact,
    GraduationCap,
    Mail,
    Settings,
    ChevronUp,
    ChevronDown,
    Plus,
    X,
    LoaderCircle
  } from "lucide-svelte";
  import { fetchUserSettings, updateUserSettings } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { toast } from "svelte-sonner";
  import { navState } from "$lib/nav-state.svelte";
  import { page } from "$app/state";

  const isAdminView = $derived(page.url.pathname.startsWith("/admin"));

  const ALL_RESIDENT_ITEMS = [
    { id: "home", label: "Home", icon: LayoutDashboard },
    { id: "finance", label: "Finance", icon: Wallet },
    { id: "occupancy", label: "Occupancy", icon: House },
    { id: "laundry", label: "Laundry", icon: WashingMachine },
    { id: "payments", label: "Payments", icon: Banknote },
    { id: "news", label: "News", icon: Megaphone },
    { id: "achievements", label: "Trophy", icon: Trophy }
  ];

  const ALL_ADMIN_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "pending", label: "Pending", icon: Receipt },
    { id: "history", label: "History", icon: History },
    { id: "residents", label: "Residents", icon: Users },
    { id: "rooms", label: "Rooms", icon: Bed },
    { id: "users", label: "Users", icon: Contact },
    { id: "terms", label: "Terms", icon: GraduationCap },
    { id: "dispatcher", label: "Email", icon: Mail },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "laundry", label: "Laundry", icon: WashingMachine },
    { id: "payments", label: "Payments", icon: Banknote },
    { id: "news", label: "News", icon: Megaphone },
    { id: "achievements", label: "Trophy", icon: Trophy }
  ];

  let residentNav = $state<string[]>([]);
  let adminNav = $state<string[]>([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let residentId = $state("");

  async function loadData() {
    if (!auth.user?.email) return;
    try {
      const [allSettings, allUsers] = await Promise.all([
        fetchUserSettings(),
        auth.authType === "admin" ? fetchUsers() : Promise.resolve([])
      ]);

      const me = allUsers.find(
        (u) => u.email.toLowerCase() === (auth.user?.email || "").toLowerCase()
      );
      residentId = me?.id || auth.user.email; // Fallback to email for residents

      const my = allSettings[0]; // fetchUserSettings handles finding the right record
      residentNav = (my?.residentNav || "").split(",").filter(Boolean);
      adminNav = (my?.adminNav || "").split(",").filter(Boolean);

      // Default fallback
      if (residentNav.length === 0) residentNav = ["home", "finance", "laundry"];
      if (adminNav.length === 0) adminNav = ["dashboard", "history", "residents"];
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  async function save() {
    if (!residentId && auth.authType !== "resident") {
      toast.error("User identity not resolved. Please refresh.");
      return;
    }
    isSaving = true;
    try {
      await updateUserSettings(residentId, {
        residentNav: residentNav.join(","),
        adminNav: adminNav.join(",")
      });
      navState.residentNavIds = [...residentNav];
      navState.adminNavIds = [...adminNav];
      toast.success("Navigation settings updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSaving = false;
    }
  }

  function toggleItem(list: string[], itemId: string, max: number = 4) {
    const idx = list.indexOf(itemId);
    if (idx > -1) {
      return list.filter((i) => i !== itemId);
    } else if (list.length < max) {
      return [...list, itemId];
    }
    return list;
  }

  function moveItem(list: string[], idx: number, direction: -1 | 1) {
    const newList = [...list];
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= newList.length) return list;
    [newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];
    return newList;
  }

  onMount(loadData);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Navigation</Card.Title>
    <Card.Description>Customize your mobile bottom navigation bar.</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-8">
    {#if !isAdminView}
      <!-- Resident Nav -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Resident Navigation
          </h4>
          <span class="text-xs text-muted-foreground">{residentNav.length} / 4 items</span>
        </div>

        <div class="flex min-h-[52px] flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
          {#each residentNav as itemId, i}
            {@const item = ALL_RESIDENT_ITEMS.find((it) => it.id === itemId)}
            {#if item}
              <Badge variant="secondary" class="flex items-center gap-1.5 px-2.5 py-1 text-sm">
                <item.icon class="h-3.5 w-3.5" />
                {item.label}
                <div class="ml-1 flex items-center gap-0.5 border-l pl-1">
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() => (residentNav = moveItem(residentNav, i, -1))}
                    disabled={i === 0}
                  >
                    <ChevronUp class="h-3 w-3" />
                  </button>
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() => (residentNav = moveItem(residentNav, i, 1))}
                    disabled={i === residentNav.length - 1}
                  >
                    <ChevronDown class="h-3 w-3" />
                  </button>
                  <button
                    class="ml-0.5 hover:text-destructive"
                    onclick={() => (residentNav = residentNav.filter((id) => id !== itemId))}
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              </Badge>
            {/if}
          {/each}
          {#if residentNav.length === 0}
            <span class="py-1 text-sm text-muted-foreground italic">No items selected.</span>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          {#each ALL_RESIDENT_ITEMS as item}
            {@const selected = residentNav.includes(item.id)}
            <Button
              variant={selected ? "default" : "outline"}
              size="sm"
              class="h-8 gap-1.5"
              onclick={() => (residentNav = toggleItem(residentNav, item.id))}
              disabled={!selected && residentNav.length >= 4}
            >
              <item.icon class="h-3.5 w-3.5" />
              {item.label}
            </Button>
          {/each}
        </div>
      </div>
    {/if}

    {#if isAdminView}
      <!-- Admin Nav -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Admin Navigation
          </h4>
          <span class="text-xs text-muted-foreground">{adminNav.length} / 4 items</span>
        </div>

        <div class="flex min-h-[52px] flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
          {#each adminNav as itemId, i}
            {@const item = ALL_ADMIN_ITEMS.find((it) => it.id === itemId)}
            {#if item}
              <Badge variant="secondary" class="flex items-center gap-1.5 px-2.5 py-1 text-sm">
                <item.icon class="h-3.5 w-3.5" />
                {item.label}
                <div class="ml-1 flex items-center gap-0.5 border-l pl-1">
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() => (adminNav = moveItem(adminNav, i, -1))}
                    disabled={i === 0}
                  >
                    <ChevronUp class="h-3 w-3" />
                  </button>
                  <button
                    class="hover:text-primary disabled:opacity-30"
                    onclick={() => (adminNav = moveItem(adminNav, i, 1))}
                    disabled={i === adminNav.length - 1}
                  >
                    <ChevronDown class="h-3 w-3" />
                  </button>
                  <button
                    class="ml-0.5 hover:text-destructive"
                    onclick={() => (adminNav = adminNav.filter((id) => id !== itemId))}
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              </Badge>
            {/if}
          {/each}
          {#if adminNav.length === 0}
            <span class="py-1 text-sm text-muted-foreground italic">No items selected.</span>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          {#each ALL_ADMIN_ITEMS as item}
            {@const selected = adminNav.includes(item.id)}
            <Button
              variant={selected ? "default" : "outline"}
              size="sm"
              class="h-8 gap-1.5"
              onclick={() => (adminNav = toggleItem(adminNav, item.id))}
              disabled={!selected && adminNav.length >= 4}
            >
              <item.icon class="h-3.5 w-3.5" />
              {item.label}
            </Button>
          {/each}
        </div>
      </div>
    {/if}
  </Card.Content>
  <Card.Footer class="flex justify-between border-t bg-muted/20">
    <p class="text-xs text-muted-foreground">Changes will take effect after you save.</p>
    <Button size="sm" onclick={save} disabled={isSaving || isLoading}>
      {#if isSaving}
        <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
      {/if}
      Save
    </Button>
  </Card.Footer>
</Card.Root>
