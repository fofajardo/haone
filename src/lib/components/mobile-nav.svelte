<script lang="ts">
  import {
    LayoutDashboard,
    History,
    CircleUser,
    Users,
    Wallet,
    WashingMachine,
    Megaphone,
    House,
    Banknote,
    Trophy,
    Receipt,
    Bed,
    Contact,
    GraduationCap,
    Mail,
    Settings
  } from "lucide-svelte";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import { page } from "$app/state";
  import { cn } from "$lib/utils";
  import { uiSettings } from "$lib/settings.svelte";
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";

  const sidebar = useSidebar();

  const MAP_RESIDENT: Record<string, any> = {
    home: { label: "Home", href: "/resident", icon: LayoutDashboard },
    finance: { label: "Finance", href: "/resident/finance", icon: Wallet },
    occupancy: { label: "Occupancy", href: "/resident/occupancy", icon: House },
    laundry: { label: "Laundry", href: "/resident/laundry", icon: WashingMachine },
    payments: { label: "Payments", href: "/resident/payment-requests", icon: Banknote },
    news: { label: "News", href: "/resident/announcements", icon: Megaphone },
    achievements: { label: "Trophy", href: "/resident/achievements", icon: Trophy }
  };

  const MAP_ADMIN: Record<string, any> = {
    dashboard: { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    pending: { label: "Pending", href: "/admin/pending", icon: Receipt },
    history: { label: "History", href: "/admin/transactions", icon: History },
    residents: { label: "Residents", href: "/admin/residents", icon: Users },
    rooms: { label: "Rooms", href: "/admin/rooms", icon: Bed },
    users: { label: "Users", href: "/admin/users", icon: Contact },
    terms: { label: "Terms", href: "/admin/academic-terms", icon: GraduationCap },
    dispatcher: { label: "Email", href: "/admin/email-dispatcher", icon: Mail },
    settings: { label: "Settings", href: "/admin/settings", icon: Settings },
    laundry: { label: "Laundry", href: "/admin/laundry", icon: WashingMachine },
    payments: { label: "Payments", href: "/admin/payment-requests", icon: Banknote },
    news: { label: "News", href: "/admin/announcements", icon: Megaphone },
    achievements: { label: "Trophy", href: "/admin/achievements", icon: Trophy }
  };

  const isAdmin = $derived(page.url.pathname.startsWith("/admin"));

  const navItems = $derived.by(() => {
    const ids = isAdmin ? uiSettings.adminNavIds : uiSettings.residentNavIds;
    const map = isAdmin ? MAP_ADMIN : MAP_RESIDENT;
    return ids.map((id) => map[id]).filter(Boolean);
  });

  function isActive(href: string) {
    if (href === "/resident" || href === "/admin") {
      return page.url.pathname === href;
    }
    return page.url.pathname.startsWith(href);
  }

  onMount(() => {
    if (auth.accessToken) {
      uiSettings.syncFromServer().catch(console.error);
    }
  });
</script>

<div class="fixed right-0 bottom-6 left-0 z-50 flex justify-center px-4 md:hidden">
  <nav
    class="flex h-16 w-full max-w-md items-center justify-around rounded-2xl border border-border bg-background/80 px-4 shadow-xl backdrop-blur-lg"
  >
    {#each navItems as item}
      <Button
        variant="ghost"
        href={item.href}
        class={cn(
          "flex h-auto flex-col items-center gap-1 p-0 transition-colors hover:bg-transparent",
          isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
        icon={item.icon}
        iconPosition="top"
        iconClass="h-6 w-6"
      >
        <span class="text-xs font-medium">{item.label}</span>
      </Button>
    {/each}

    <Button
      variant="ghost"
      class="flex h-auto flex-col items-center gap-1 p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
      onclick={() => sidebar.setOpenMobile(true)}
      icon={CircleUser}
      iconPosition="top"
      iconClass="h-6 w-6"
    >
      <span class="text-xs font-medium">You</span>
    </Button>
  </nav>
</div>
