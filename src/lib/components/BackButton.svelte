<script lang="ts">
  import { ChevronLeft } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";

  let {
    href = "",
    onclick = undefined,
    class: className = ""
  }: {
    href?: string;
    onclick?: () => void;
    class?: string;
  } = $props();

  function handleBack(e: MouseEvent) {
    if (onclick) {
      onclick();
    } else if (!href) {
      history.back();
    }
  }
</script>

<Button variant="ghost" size="icon" {href} onclick={handleBack} class="h-9 w-9 {className}">
  <ChevronLeft class="h-5 w-5" />
</Button>
