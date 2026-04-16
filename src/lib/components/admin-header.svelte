<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { brandingState } from "$lib/branding.svelte";

  const sidebar = Sidebar.useSidebar();
</script>

<header
  class="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur transition-all supports-[backdrop-filter]:bg-background/60"
>
  <div class="flex items-center gap-2">
    <Sidebar.Trigger class="-ml-1" />

    <div class="flex items-center gap-2 px-2">
      <img
        src={brandingState.profile.logoUrl}
        alt={brandingState.profile.logoAlt}
        class="h-10 w-auto object-contain"
      />
    </div>
  </div>
</header>
