<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Button } from "$lib/components/ui/button";
  import { auth } from "$lib/state/auth.svelte";
  import { X } from "@lucide/svelte";
  import BrandingLogo from "$lib/components/BrandingLogo.svelte";

  const sidebar = Sidebar.useSidebar();
</script>

{#if sidebar.isMobile}
  {#if auth.user}
    <div class="flex items-center justify-between px-4 py-3 shrink-0">
      <BrandingLogo class="h-8 w-auto object-contain" />
      <Button
        variant="ghost"
        size="icon-lg"
        class="size-10 shrink-0 [&_svg]:size-6"
        onclick={() => sidebar.setOpenMobile(false)}
        icon={X}
      />
    </div>
  {/if}
{:else}
  <div
    class="flex items-center justify-center px-2 py-4 h-16 transition-all duration-300 ease-in-out group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:opacity-0 overflow-hidden shrink-0"
  >
    <BrandingLogo
      class="h-8 w-auto mx-auto object-contain transition-transform duration-300 group-data-[collapsible=icon]:scale-0"
    />
  </div>
{/if}
