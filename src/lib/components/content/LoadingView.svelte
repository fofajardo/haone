<script lang="ts">
  let { class: className = "" } = $props();
</script>

<div class="flex flex-col gap-4 {className}">
  <div class="h-50 w-full animate-pulse rounded-md bg-muted"></div>
</div>
