<script lang="ts">
  import { Checkbox } from "$ui/checkbox/index.js";
  import { cn } from "$lib/utils";

  let {
    checked = $bindable(false),
    onCheckedChange,
    class: className = "",
    ...restProps
  } = $props();
</script>

<Checkbox bind:checked {onCheckedChange} class={cn(className)} {...restProps} />
