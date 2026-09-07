<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import { Button } from "$ui/button";
  import { auth } from "$state/auth.svelte";
  import { X } from "@lucide/svelte";

  const sidebar = Sidebar.useSidebar();
</script>

{#if sidebar.isMobile && auth.user}
  <div class="flex shrink-0 items-center justify-end px-4 py-3">
    <Button
      variant="ghost"
      size="icon-lg"
      class="size-10 shrink-0 [&_svg]:size-6"
      onclick={() => sidebar.setOpenMobile(false)}
      icon={X}
    />
  </div>
{/if}
