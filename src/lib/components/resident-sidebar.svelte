<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import {
    LayoutDashboard,
    Settings,
    LogOut,
    X,
    CircleUser,
    Wallet,
    House,
    WashingMachine,
    Banknote,
    Megaphone,
    Trophy,
    BookUser,
    CirclePlus
  } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { auth } from "$lib/auth.svelte";
  import { residentState } from "$lib/resident-state.svelte";
  import { page } from "$app/state";
  import { canAccessLaundry, canAccessAchievements } from "$lib/resident-logic";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);

  const mgmtItems = [
    {
      title: "Dashboard",
      url: "/resident",
      icon: LayoutDashboard
    },
    {
      title: "Finance",
      url: "/resident/finance",
      icon: Wallet
    },
    {
      title: "Occupancy",
      url: "/resident/occupancy",
      icon: House
    }
  ];

  const serviceItems = [
    {
      title: "Laundry",
      url: "/resident/laundry",
      icon: WashingMachine
    },
    {
      title: "Payment Requests",
      url: "/resident/payment-requests",
      icon: Banknote
    },
    {
      title: "Announcements",
      url: "/resident/announcements",
      icon: Megaphone
    },
    {
      title: "Achievements",
      url: "/resident/achievements",
      icon: Trophy
    },
    {
      title: "Officers",
      url: "/resident/officers",
      icon: BookUser
    }
  ];

  const filteredServiceItems = $derived.by(() => {
    const type = residentState.status?.account?.type || "";
    return serviceItems.filter((item) => {
      if (item.title === "Laundry") {
        if (!canAccessLaundry(type)) {
          return false;
        }
      }
      if (item.title === "Achievements") {
        if (!canAccessAchievements(type)) {
          return false;
        }
      }
      return true;
    });
  });

  const secondaryItems = [
    {
      title: "Settings",
      url: "/resident/settings",
      icon: Settings
    }
  ];

  if (auth.authType === "admin") {
    secondaryItems.unshift({
      title: "Admin View",
      url: "/admin",
      icon: House
    });
  }
</script>

<Sidebar.Root collapsible="icon" class="data-[mobile=true]:w-full!">
  <Sidebar.Header>
    <div class="flex items-center gap-2 px-2 py-4">
      <img src="/ha1.svg" alt="HAOne" class="h-8 w-8" />
      <span class="text-xl font-bold tracking-tight group-data-[collapsible=icon]:hidden"
        >HAOne</span
      >
      {#if sidebar.isMobile}
        <div class="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            class="h-10 gap-2 px-3 text-muted-foreground hover:text-foreground"
            onclick={() => auth.logout()}
          >
            <LogOut class="h-5 w-5" />
            <span class="text-sm font-medium">Sign out</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            class="size-10 [&_svg]:size-6"
            onclick={() => sidebar.setOpenMobile(false)}
          >
            <X />
          </Button>
        </div>
      {/if}
    </div>
    {#if sidebar.isMobile && auth.user}
      <div class="flex flex-col gap-4 px-4 pt-2 pb-6">
        <div class="flex items-center gap-4">
          {#if !imgError}
            <img
              src={auth.cachedPicture || auth.user.picture}
              alt={auth.user.name}
              class="h-16 w-16 rounded-full border-2 border-primary/20 object-cover shadow-sm"
              onerror={() => (imgError = true)}
            />
          {:else}
            <CircleUser class="h-16 w-16 text-muted-foreground" />
          {/if}
          <div class="flex flex-col">
            <span class="text-lg font-bold tracking-tight">{auth.user.name}</span>
            <span class="text-sm text-muted-foreground">{auth.user.email}</span>
          </div>
        </div>
      </div>
      <Sidebar.Separator />
    {/if}
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Management</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each mgmtItems as item}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              isActive={page.url.pathname === item.url}
              onclick={() => sidebar.setOpenMobile(false)}
            >
              {#snippet child({ props })}
                <a href={item.url} {...props} onclick={() => sidebar.setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
        {#if residentState.status?.account?.type === "ALUMNUS" || residentState.status?.currEntry?.accountType === "ALUMNUS"}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              onclick={() => {
                sidebar.setOpenMobile(false);
                residentState.forceOnboarding = true;
              }}
            >
              <CirclePlus />
              <span>Check In</span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/if}
      </Sidebar.Menu>
    </Sidebar.Group>

    <Sidebar.Group>
      <Sidebar.GroupLabel>Services</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each filteredServiceItems as item}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              isActive={page.url.pathname === item.url}
              onclick={() => sidebar.setOpenMobile(false)}
            >
              {#snippet child({ props })}
                <a href={item.url} {...props} onclick={() => sidebar.setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
      </Sidebar.Menu>
    </Sidebar.Group>

    <Sidebar.Group class="mt-auto">
      <Sidebar.Menu>
        {#each secondaryItems as item}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              size={sidebar.isMobile ? "lg" : "default"}
              isActive={page.url.pathname === item.url}
              onclick={() => sidebar.setOpenMobile(false)}
            >
              {#snippet child({ props })}
                <a href={item.url} {...props} onclick={() => sidebar.setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
      </Sidebar.Menu>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        {#if auth.user && !sidebar.isMobile}
          <div class="flex items-center gap-3 p-2 group-data-[collapsible=icon]:p-0">
            {#if !imgError}
              <img
                src={auth.cachedPicture || auth.user.picture}
                alt={auth.user.name}
                class="h-8 w-8 rounded-full border border-border"
                onerror={() => (imgError = true)}
              />
            {:else}
              <CircleUser class="h-8 w-8 text-muted-foreground" />
            {/if}
            <div class="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span class="truncate text-xs font-semibold">{auth.user.name}</span>
              <span class="truncate text-xs text-muted-foreground">{auth.user.email}</span>
            </div>
            <button
              onclick={() => auth.logout()}
              class="ml-auto rounded group-data-[collapsible=icon]:hidden hover:bg-muted {sidebar.isMobile
                ? 'p-2'
                : 'p-1'}"
              title="Logout"
            >
              <LogOut class={sidebar.isMobile ? "h-5 w-5" : "h-4 w-4"} />
            </button>
          </div>
        {/if}
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
