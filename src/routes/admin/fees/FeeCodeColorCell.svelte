<script lang="ts">
  let { color }: { color: string } = $props();
</script>

<span
  class="inline-block size-4 rounded-full border border-border"
  style="background-color: {color}"
  title={color}
></span>
