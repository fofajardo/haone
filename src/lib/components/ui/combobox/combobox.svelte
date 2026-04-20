<script lang="ts">
  import { browser } from "$app/environment";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Drawer from "$lib/components/ui/drawer/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { onMount, tick } from "svelte";
  import Check from "lucide-svelte/icons/check";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import { cn } from "$lib/utils.js";

  let {
    value = $bindable(""),
    options = [],
    placeholder = "Select item...",
    searchPlaceholder = "Search item...",
    emptyMessage = "No item found.",
    disabled = false,
    class: className = "",
    onSelect
  }: {
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    disabled?: boolean;
    class?: string;
    onSelect?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let isDesktop = $state(false);
  let triggerRef = $state<HTMLButtonElement>(null!);

  function checkScreenSize() {
    isDesktop = window.innerWidth >= 768;
  }

  onMount(() => {
    if (browser) {
      checkScreenSize();
      window.addEventListener("resize", checkScreenSize);
      return () => window.removeEventListener("resize", checkScreenSize);
    }
  });

  const selectedLabel = $derived(options.find((o) => o.value === value)?.label || value);

  function handleSelect(val: string) {
    value = val;
    open = false;
    onSelect?.(val);
    if (isDesktop) {
      tick().then(() => triggerRef?.focus());
    }
  }
</script>

{#if isDesktop}
  <Popover.Root bind:open>
    <Popover.Trigger bind:ref={triggerRef} {disabled} class={cn("block w-full", className)}>
      {#snippet child({ props }: { props: Record<string, any> })}
        <button
          {...props}
          class={cn(
            buttonVariants({ variant: "outline" }),
            "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left font-normal",
            className
          )}
          role="combobox"
          aria-expanded={open}
        >
          <span class="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
        </button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0" align="start">
      <Command.Root>
        <Command.Input placeholder={searchPlaceholder} />
        <Command.List>
          <Command.Empty>{emptyMessage}</Command.Empty>
          <Command.Group>
            {#each options as opt (opt.value)}
              <Command.Item
                value={opt.label + " " + opt.value}
                onSelect={() => handleSelect(opt.value)}
                disabled={opt.disabled}
                class={cn(opt.disabled && "opacity-50")}
              >
                <Check class={cn("mr-2 h-4 w-4", value !== opt.value && "text-transparent")} />
                {opt.label}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
{:else}
  <Drawer.Root bind:open>
    <Drawer.Trigger {disabled} class={cn("block w-full", className)}>
      {#snippet child({ props }: { props: Record<string, any> })}
        <button
          {...props}
          class={cn(
            buttonVariants({ variant: "outline" }),
            "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left font-normal",
            className
          )}
        >
          <span class="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
        </button>
      {/snippet}
    </Drawer.Trigger>
    <Drawer.Content>
      <div class="mt-4 border-t px-4 pb-8">
        <Command.Root>
          <Command.Input placeholder={searchPlaceholder} class="my-2" />
          <Command.List>
            <Command.Empty>{emptyMessage}</Command.Empty>
            <Command.Group>
              {#each options as opt (opt.value)}
                <Command.Item
                  value={opt.label + " " + opt.value}
                  onSelect={() => handleSelect(opt.value)}
                  disabled={opt.disabled}
                  class={cn(opt.disabled && "opacity-50")}
                >
                  <Check class={cn("mr-2 h-4 w-4", value !== opt.value && "text-transparent")} />
                  {opt.label}
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.List>
        </Command.Root>
      </div>
    </Drawer.Content>
  </Drawer.Root>
{/if}
