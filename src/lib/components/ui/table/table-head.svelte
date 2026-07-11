<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLThAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLThAttributes> = $props();
</script>

<th
  bind:this={ref}
  data-slot="table-head"
  class={cn(
    "h-9 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&:has([role=checkbox])]:text-center [&:has([role=checkbox])_button]:mx-auto",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</th>
