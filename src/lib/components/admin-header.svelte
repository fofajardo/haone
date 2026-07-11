<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { brandingState } from "$lib/branding.svelte";
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { LogOut, CircleUser } from "@lucide/svelte";

  interface Props {
    hideToggle?: boolean;
  }
  const { hideToggle = false }: Props = $props();
  const sidebar = Sidebar.useSidebar();
</script>

<header
  class="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur transition-all supports-[backdrop-filter]:bg-background/60"
>
  <div class="flex items-center gap-2">
    {#if !hideToggle}
      <Sidebar.Trigger
        class="-ml-1 hidden md:flex {sidebar.isMobile ? 'size-10 [&_svg]:size-6' : ''}"
        size={sidebar.isMobile ? "icon-lg" : "icon-sm"}
      />
    {/if}

    <div class="flex items-center gap-2 px-2">
      <img
        src={brandingState.profile.logoUrl}
        alt={brandingState.profile.logoAlt}
        class="h-10 w-auto object-contain dark:hidden"
      />
      <img
        src={brandingState.profile.logoUrlDark || brandingState.profile.logoUrl}
        alt={brandingState.profile.logoAlt}
        class="hidden h-10 w-auto object-contain dark:block"
      />
    </div>
  </div>

  <div class="flex items-center gap-2">
    {#if hideToggle}
      <Button variant="ghost" size="sm" onclick={() => auth.logout()} icon={LogOut}>Sign Out</Button
      >
    {/if}

    {#if !hideToggle}
      <button
        onclick={() => sidebar.setOpenMobile(true)}
        class="md:hidden flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-border transition-opacity hover:opacity-80"
        aria-label="Open menu"
      >
        {#if auth.user?.picture}
          <img src={auth.user.picture} alt={auth.user.name} class="h-full w-full object-cover" />
        {:else}
          <CircleUser class="h-6 w-6 text-muted-foreground" />
        {/if}
      </button>
    {/if}
  </div>
</header>
