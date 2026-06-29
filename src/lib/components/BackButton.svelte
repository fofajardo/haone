<script lang="ts">
  import { ChevronLeft } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { useSidebar } from "$lib/components/ui/sidebar/context.svelte.js";

  let {
    href = "",
    onclick = undefined,
    class: className = ""
  }: {
    href?: string;
    onclick?: () => void;
    class?: string;
  } = $props();

  const sidebar = useSidebar();

  function handleBack(e: MouseEvent) {
    if (sidebar.isMobile && sidebar.openMobile) {
      e.preventDefault();
      sidebar.setOpenMobile(false);
      return;
    }

    if (onclick) {
      onclick();
    } else if (!href) {
      history.back();
    }
  }
</script>

<Button
  variant="ghost"
  size="icon"
  {href}
  onclick={handleBack}
  icon={ChevronLeft}
  class="h-9 w-9 {className}"
/>
