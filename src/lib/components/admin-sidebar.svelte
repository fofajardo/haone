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
    Network,
    Database
  } from "@lucide/svelte";
  import { dev } from "$app/environment";
  import { Button } from "$ui/button";
  import { auth } from "$state/auth.svelte";
  import { page } from "$app/state";
  import ProfileHeader from "$components/ProfileHeader.svelte";
  import MobileProfileCard from "$components/MobileProfileCard.svelte";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);
  const items = [
    {
      title: "Dashboard",
      url: "/admin",
      icon: LayoutDashboard
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
      title: "Financial Report",
      url: "/admin/financial-report",
      icon: HandCoins
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

  const serviceItems = [
    {
      title: "Laundry",
      url: "/admin/laundry",
      icon: WashingMachine
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
    {
      title: "Static IP Address",
      url: "/admin/static-ip",
      icon: Network
    }
  ];
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
