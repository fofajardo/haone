<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
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
    Refrigerator
  } from "@lucide/svelte";
  import { Button } from "$ui/button/index.js";
  import { auth } from "$state/auth.svelte";
  import { residentState } from "$state/resident-state.svelte";
  import { page } from "$app/state";
  import { isResidentRouteAllowed } from "$api/controllers/resident-controller";
  import { getCustomServices } from "$lib/services";
  import { AccountType } from "$lib/types";
  import ProfileHeader from "$components/nav/ProfileHeader.svelte";
  import MobileProfileCard from "$components/nav/MobileProfileCard.svelte";

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

  const serviceItems = $derived([
    {
      title: "Laundry",
      url: "/resident/laundry",
      icon: WashingMachine
    },
    {
      title: "Fridge",
      url: "/resident/fridge",
      icon: Refrigerator
    },
    {
      title: "Payment Requests",
      url: "/resident/payment-requests",
      icon: Banknote
    },
    ...getCustomServices("resident"),
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
  ]);

  const isAlum = $derived(residentState.status?.currEntry?.accountType === AccountType.ALUMNUS);

  const filteredServiceItems = $derived.by(() => {
    const type = residentState.status?.account?.type || "";
    const room = residentState.status?.account?.room || "";
    return serviceItems.filter((item) => {
      return isResidentRouteAllowed(item.url, type, room);
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
  <Sidebar.Header class="shrink-0 p-0">
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

    {#if sidebar.isMobile}
      <Sidebar.Group class="mt-auto">
        <Sidebar.Menu>
          {#each secondaryItems as item}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                size="lg"
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
    {/if}
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
