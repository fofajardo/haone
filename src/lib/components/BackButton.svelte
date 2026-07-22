<script lang="ts">
  import { ChevronLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { Button } from "$ui/button";
  import { useSidebar } from "$ui/sidebar/context.svelte.js";

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

  function getParentPath(pathname: string): string {
    const segments = pathname.split("/").filter(Boolean);
    segments.pop();
    return "/" + segments.join("/");
  }

  function handleBack(e: MouseEvent) {
    if (sidebar.isMobile && sidebar.openMobile) {
      e.preventDefault();
      sidebar.setOpenMobile(false);
      return;
    }

    if (onclick) {
      onclick();
    } else if (!href) {
      goto(getParentPath(window.location.pathname));
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
