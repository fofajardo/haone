<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLTdAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLTdAttributes> = $props();
</script>

<td
  bind:this={ref}
  data-slot="table-cell"
  class={cn(
    "p-2 align-top whitespace-nowrap has-[[role=checkbox]]:pr-0 has-[[role=checkbox]]:text-center [&:has([role=checkbox])_button]:mx-auto",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</td>
