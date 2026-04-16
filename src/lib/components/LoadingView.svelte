<script lang="ts">
  import { Loader2 } from "lucide-svelte";

  let { text = "Loading records...", class: className = "" } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 {className}">
  <Loader2 class="h-8 w-8 animate-spin text-primary opacity-20" />
  <p class="text-xs font-medium text-muted-foreground">{text}</p>
</div>
