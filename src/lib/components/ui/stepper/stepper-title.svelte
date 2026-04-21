<script lang="ts">
  import { cn } from "../../../utils";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    class: className,
    children,
    hideTitle = "sm",
    size = "lg",
    ...rest
  }: HTMLAttributes<HTMLDivElement> & {
    hideTitle?: "never" | "sm" | "md" | "lg" | "inactive";
    size?: "sm" | "lg";
  } = $props();
</script>

<div
  data-slot="stepper-title"
  class={cn(
    "mt-1 font-medium",
    size === "sm" ? "text-sm" : "text-lg",
    hideTitle === "sm" && "hidden sm:inline",
    hideTitle === "md" && "hidden md:inline",
    hideTitle === "lg" && "hidden lg:inline",
    hideTitle === "inactive" && "hidden group-data-[state=active]/stepper-item:inline sm:inline",
    "group-data-[orientation=vertical]/stepper-nav:text-left",
    "group-data-[orientation=horizontal]/stepper-nav:text-center",
    className
  )}
  {...rest}
>
  {@render children?.()}
</div>
