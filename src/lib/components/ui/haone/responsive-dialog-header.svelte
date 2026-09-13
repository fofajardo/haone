<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import * as Drawer from "$ui/drawer";
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";

  let {
    class: className,
    children,
    ...restProps
  }: {
    class?: string;
    children?: Snippet;
    [key: string]: any;
  } = $props();

  const isDesktop = getContext<{ current: boolean }>("rdialog:isDesktop");
</script>

{#if isDesktop.current}
  <Dialog.Header class={className} {...restProps}>
    {@render children?.()}
  </Dialog.Header>
{:else}
  <Drawer.Header class={className} {...restProps}>
    {@render children?.()}
  </Drawer.Header>
{/if}
