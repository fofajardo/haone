<script lang="ts">
  import { Checkbox } from "$ui/checkbox/index.js";
  import type { Table } from "@tanstack/table-core";

  let { table }: { table: Table<any> } = $props();

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

<div onclick={handleClick} role="presentation">
  <Checkbox
    checked={table.getIsAllPageRowsSelected()}
    indeterminate={table.getIsSomePageRowsSelected()}
    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
    aria-label="Select all"
  />
</div>
