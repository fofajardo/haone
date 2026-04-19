<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import {
    LayoutDashboard,
    Settings,
    Receipt,
    ListFilter,
    Users,
    LogOut,
    ChartPie,
    Mail,
    FileSpreadsheet,
    HandCoins
  } from "lucide-svelte";
  import { auth } from "$lib/auth.svelte";
  import { page } from "$app/state";

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
      icon: ListFilter
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

<Sidebar.Root collapsible="icon">
  <Sidebar.Header>
    <div class="flex items-center gap-2 px-2 py-4">
      <img src="/ha1.svg" alt="HAOne" class="h-8 w-8" />
      <span class="text-xl font-bold tracking-tight group-data-[collapsible=icon]:hidden"
        >HAOne</span
      >
    </div>
  </Sidebar.Header>

  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Management</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each items as item}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton isActive={page.url.pathname === item.url}>
              {#snippet child({ props })}
                <a href={item.url} {...props}>
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
              <Sidebar.MenuButton isActive={page.url.pathname === item.url}>
                {#snippet child({ props })}
                  <a href={item.url} {...props}>
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
            <Sidebar.MenuButton isActive={page.url.pathname === item.url}>
              {#snippet child({ props })}
                <a href={item.url} {...props}>
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
          <div class="flex items-center gap-3 p-2 group-data-[collapsible=icon]:p-0">
            <img
              src={auth.user.picture}
              alt={auth.user.name}
              class="h-8 w-8 rounded-full border border-border"
            />
            <div class="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span class="truncate text-xs font-semibold">{auth.user.name}</span>
              <span class="truncate text-[10px] text-muted-foreground">{auth.user.email}</span>
            </div>
            <button
              onclick={() => auth.logout()}
              class="ml-auto rounded p-1 group-data-[collapsible=icon]:hidden hover:bg-muted"
              title="Logout"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
        {/if}
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
