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
    ListOrdered,
    BookUser,
    CirclePlus,
    Network
  } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { auth } from "$lib/state/auth.svelte";
  import { residentState } from "$lib/state/resident-state.svelte";
  import { page } from "$app/state";
  import { canAccessLaundry, canAccessAchievements } from "$lib/logic/resident-logic";
  import { AccountType } from "$lib/schemas";
  import { isStaticIpEnabled } from "$lib/utils/rooms-utils";
  import ProfileHeader from "$lib/components/ProfileHeader.svelte";
  import MobileProfileCard from "$lib/components/MobileProfileCard.svelte";

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
      title: "Static IP Address",
      url: "/resident/static-ip",
      icon: Network
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
      title: "Leaderboards",
      url: "/resident/leaderboards",
      icon: ListOrdered
    },
    {
      title: "Officers",
      url: "/resident/officers",
      icon: BookUser
    }
  ];

  const isAlum = $derived(residentState.status?.currEntry?.accountType === AccountType.ALUMNUS);

  const filteredServiceItems = $derived.by(() => {
    const type = residentState.status?.account?.type || "";
    const room = residentState.status?.account?.room || "";
    return serviceItems.filter((item) => {
      if (item.title === "Laundry") {
        if (!canAccessLaundry(type)) {
          return false;
        }
      }
      if (item.title === "Achievements") {
        if (isAlum) {
          return true;
        }
        if (!canAccessAchievements(type)) {
          return false;
        }
      }
      if (item.title === "Static IP Address") {
        if (!room || !isStaticIpEnabled(room, "ati") || !canAccessLaundry(type)) {
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
  <Sidebar.Header class="p-0 shrink-0">
    <ProfileHeader />
  </Sidebar.Header>

  <Sidebar.Content>
    <MobileProfileCard />
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
        {#if isAlum}
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
        {#if auth.user}
          {#if !sidebar.isMobile}
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
              <Button
                variant="ghost"
                size="icon"
                onclick={() => auth.logout()}
                class="ml-auto group-data-[collapsible=icon]:hidden"
                icon={LogOut}
                title="Logout"
              />
            </div>
          {/if}
        {/if}
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
