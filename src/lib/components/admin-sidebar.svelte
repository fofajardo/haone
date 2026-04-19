<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import {
    LayoutDashboard,
    Settings,
    Receipt,
    Users,
    LogOut,
    ChartPie,
    Mail,
    FileSpreadsheet,
    HandCoins,
    X,
    History,
    CircleUser
  } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { auth } from "$lib/auth.svelte";
  import { page } from "$app/state";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);
  const items = [
    {
      title: "Dashboard",
      url: "/admin",
      icon: LayoutDashboard
    },
    {
      title: "Pending Receipts",
      url: "/admin/pending",
      icon: Receipt
    },
    {
      title: "Transactions",
      url: "/admin/transactions",
      icon: History
    },
    {
      title: "Residents",
      url: "/admin/residents",
      icon: Users
    }
  ];

  const reportItems = [
    {
      title: "Financial Report",
      url: "/admin/reports/financial-report",
      icon: HandCoins
    },
    {
      title: "Resident List",
      url: "/admin/reports/resident-list",
      icon: FileSpreadsheet
    },
    {
      title: "Demographics",
      url: "/admin/reports/demographics",
      icon: ChartPie
    }
  ];

  const secondaryItems = [
    {
      title: "Email Dispatcher",
      url: "/admin/email-dispatcher",
      icon: Mail
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings
    }
  ];
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
      <Sidebar.GroupLabel>Reports</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {#each reportItems as item}
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
      </Sidebar.GroupContent>
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
              <span class="truncate text-[10px] text-muted-foreground">{auth.user.email}</span>
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
