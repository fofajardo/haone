<script lang="ts">
  import {
    LayoutDashboard,
    History,
    CircleUser,
    Users,
    Wallet,
    WashingMachine
  } from "lucide-svelte";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import { page } from "$app/state";
  import { cn } from "$lib/utils";

  const sidebar = useSidebar();

  const isAdmin = $derived(page.url.pathname.startsWith("/admin"));

  const adminItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "History", href: "/admin/transactions", icon: History },
    { label: "Residents", href: "/admin/residents", icon: Users }
  ];

  const residentItems = [
    { label: "Home", href: "/resident", icon: LayoutDashboard },
    { label: "Finance", href: "/resident/finance", icon: Wallet },
    { label: "Laundry", href: "/resident/laundry", icon: WashingMachine }
  ];

  const navItems = $derived(isAdmin ? adminItems : residentItems);

  function isActive(href: string) {
    if (href === "/resident" || href === "/admin") {
      return page.url.pathname === href;
    }
    return page.url.pathname.startsWith(href);
  }
</script>

<div class="fixed right-0 bottom-6 left-0 z-50 flex justify-center px-4 md:hidden">
  <nav
    class="flex h-16 w-full max-w-md items-center justify-around rounded-2xl border border-border bg-background/80 px-4 shadow-xl backdrop-blur-lg"
  >
    {#each navItems as item}
      <a
        href={item.href}
        class={cn(
          "flex flex-col items-center gap-1 transition-colors",
          isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <item.icon class="h-6 w-6" />
        <span class="text-xs font-medium">{item.label}</span>
      </a>
    {/each}

    <button
      onclick={() => sidebar.setOpenMobile(true)}
      class="flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <CircleUser class="h-6 w-6" />
      <span class="text-xs font-medium">You</span>
    </button>
  </nav>
</div>
