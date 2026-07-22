<script lang="ts">
  import { Checkbox } from "$ui/checkbox/index.js";
  import type { Row } from "@tanstack/table-core";

  let { row }: { row: Row<any> } = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<div onclick={handleClick} role="presentation">
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
</div>
