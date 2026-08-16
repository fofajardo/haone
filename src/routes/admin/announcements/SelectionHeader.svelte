<script lang="ts">
  import { Checkbox } from "$ui/checkbox/index.js";

  let {
    table
  }: {
    table: {
      getIsAllPageRowsSelected: () => boolean;
      getIsSomePageRowsSelected: () => boolean;
      toggleAllPageRowsSelected: (value: boolean) => void;
      [key: string]: any;
    };
  } = $props();

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
