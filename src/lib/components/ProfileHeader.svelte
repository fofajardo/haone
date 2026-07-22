<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import { Button } from "$ui/button";
  import { auth } from "$state/auth.svelte";
  import { X } from "@lucide/svelte";
  import BrandingLogo from "$components/BrandingLogo.svelte";

  const sidebar = Sidebar.useSidebar();
</script>

{#if sidebar.isMobile}
  {#if auth.user}
    <div class="flex shrink-0 items-center justify-between px-4 py-3">
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
    class="flex h-16 shrink-0 items-center justify-center overflow-hidden px-2 py-4 transition-all duration-300 ease-in-out group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:opacity-0"
  >
    <BrandingLogo
      class="mx-auto h-8 w-auto object-contain transition-transform duration-300 group-data-[collapsible=icon]:scale-0"
    />
  </div>
{/if}
