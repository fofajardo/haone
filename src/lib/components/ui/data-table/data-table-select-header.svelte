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
</script>

<Checkbox
  checked={table.getIsAllPageRowsSelected()}
  indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
  aria-label="Select all"
/>
