<script lang="ts">
  import { LoaderCircle } from "lucide-svelte";

  let { class: className = "" } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 {className}">
  <LoaderCircle class="h-8 w-8 animate-spin text-primary" />
</div>
