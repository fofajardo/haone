<script lang="ts">
  import * as Dialog from "$ui/dialog";
  import * as Drawer from "$ui/drawer";
  import { MediaQuery } from "svelte/reactivity";
  import { setContext } from "svelte";
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    children,
    ...restProps
  }: {
    open?: boolean;
    children?: Snippet;
    [key: string]: any;
  } = $props();

  const isDesktop = new MediaQuery("(min-width: 768px)");

  setContext("rdialog:isDesktop", {
    get current() {
      return isDesktop.current;
    }
  });
</script>

{#if isDesktop.current}
  <Dialog.Root bind:open {...restProps}>
    {@render children?.()}
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open {...restProps}>
    {@render children?.()}
  </Drawer.Root>
{/if}
