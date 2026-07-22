<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { auth } from "$lib/state/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { LogOut, CircleUser } from "@lucide/svelte";
  import BrandingLogo from "$lib/components/BrandingLogo.svelte";

  interface Props {
    hideToggle?: boolean;
  }
  const { hideToggle = false }: Props = $props();
  const sidebar = Sidebar.useSidebar();
</script>

<header class="flex h-16 shrink-0 items-center justify-between gap-2 bg-background/95 px-4">
  <div class="flex items-center gap-2">
    <div class="flex items-center gap-2 px-2">
      <BrandingLogo class="h-10 w-auto object-contain" />
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
