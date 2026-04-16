<script lang="ts">
  import { LoaderCircle } from "lucide-svelte";

  let { text = "Loading records...", class: className = "" } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 {className}">
  <LoaderCircle class="h-8 w-8 animate-spin text-primary opacity-20" />
  <p class="text-xs font-medium text-muted-foreground">{text}</p>
</div>
