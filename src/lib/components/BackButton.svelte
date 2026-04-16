<script lang="ts">
  import { ChevronLeft } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";

  let { href = "", class: className = "" } = $props();
</script>

<Button variant="ghost" size="icon" {href} class="h-9 w-9 {className}">
  <ChevronLeft class="h-5 w-5" />
</Button>
