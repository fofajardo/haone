<script lang="ts">
  import { Checkbox } from "$ui/checkbox/index.js";

  let {
    row
  }: {
    row: {
      getIsSelected: () => boolean;
      toggleSelected: (value: boolean) => void;
      [key: string]: any;
    };
  } = $props();
</script>

<div onclick={(e) => e.stopPropagation()} role="presentation">
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    aria-label="Select row"
  />
</div>
