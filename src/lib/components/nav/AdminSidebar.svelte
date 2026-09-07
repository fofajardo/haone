<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import {
    LayoutDashboard,
    Settings,
    Receipt,
    Users,
    LogOut,
    ChartPie,
    Mail,
    HandCoins,
    RotateCcwClock,
    CircleUser,
    GraduationCap,
    Contact,
    WashingMachine,
    Banknote,
    Megaphone,
    Trophy,
    ListOrdered,
    Database,
    Refrigerator
  } from "@lucide/svelte";
  import { dev } from "$app/environment";
  import { Button } from "$ui/button";
  import { auth } from "$state/auth.svelte";
  import { page } from "$app/state";
  import ProfileHeader from "$components/nav/ProfileHeader.svelte";
  import MobileProfileCard from "$components/nav/MobileProfileCard.svelte";
  import { getCustomServices } from "$lib/services";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);
  const items = [
    {
      title: "Dashboard",
      url: "/admin",
      icon: LayoutDashboard
    },
    {
      title: "Financial Report",
      url: "/admin/financial-report",
      icon: HandCoins
    },
    {
      title: "Transactions",
      url: "/admin/transactions",
      icon: RotateCcwClock
    },
    {
      title: "Residents",
      url: "/admin/residents",
      icon: Users
    },
    {
      title: "Users",
      url: "/admin/users",
      icon: Contact
    },
    {
      title: "Demographics",
      url: "/admin/demographics",
      icon: ChartPie
    },
    {
      title: "Academic Terms",
      url: "/admin/academic-terms",
      icon: GraduationCap
    }
  ];

  const secondaryItems = $derived(
    [
      {
        title: "Resident View",
        url: "/resident",
        icon: LayoutDashboard,
        hide: auth.isInstanceAdmin
      },
      {
        title: "Email Dispatcher",
        url: "/admin/email-dispatcher",
        icon: Mail
      },
      {
        title: "Database Sync",
        url: "/admin/database-sync",
        icon: Database,
        hide: !dev
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings
      }
    ].filter((i) => !i.hide)
  );

  const serviceItems = $derived([
    {
      title: "Laundry",
      url: "/admin/laundry",
      icon: WashingMachine
    },
    {
      title: "Fridge",
      url: "/admin/fridge",
      icon: Refrigerator
    },
    {
      title: "Announcements",
      url: "/admin/announcements",
      icon: Megaphone
    },
    {
      title: "Achievements",
      url: "/admin/achievements",
      icon: Trophy
    },
    {
      title: "Leaderboards",
      url: "/admin/leaderboards",
      icon: ListOrdered
    },
    ...getCustomServices("admin")
  ]);
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
        {#each items as item}
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

    <Sidebar.Group>
      <Sidebar.GroupLabel>Services</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each serviceItems as item}
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
