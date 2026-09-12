<script lang="ts">
  import { browser } from "$app/environment";
  import { type ResidentRecord } from "$lib/types";
  import { buttonVariants } from "$ui/button/index.js";
  import * as Command from "$ui/command/index.js";
  import * as Drawer from "$ui/drawer/index.js";
  import * as Popover from "$ui/popover/index.js";
  import { Label } from "$ui/label";
  import { onMount, tick } from "svelte";
  import { Check, ChevronsUpDown } from "@lucide/svelte";
  import { cn } from "$lib/utils.js";

  let {
    label,
    placeholder = "Select resident…",
    searchPlaceholder = "Search resident name or email…",
    emptyMessage = "No resident found.",
    accounts = [],
    filter = (_a: ResidentRecord) => true,
    useOfficialName = false,
    value = $bindable(""),
    onSelect,
    disabled = false,
    class: className = ""
  }: {
    label?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    accounts: ResidentRecord[];
    filter?: (a: ResidentRecord) => boolean;
    useOfficialName?: boolean;
    value?: string;
    onSelect?: (a: ResidentRecord) => void;
    disabled?: boolean;
    class?: string;
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
      return () => {
        window.removeEventListener("resize", checkScreenSize);
      };
    }
  });

  const getDisplayName = (a: ResidentRecord) => (useOfficialName ? a.ceFullName || a.name : a.name);

  const availableAccounts = $derived(accounts.filter(filter));

  const selectedAccount = $derived(
    availableAccounts.find(
      (a) => getDisplayName(a) === value || a.email === value || a.residentId === value
    )
  );

  const displayLabel = $derived(selectedAccount ? getDisplayName(selectedAccount) : value);

  function handleSelect(a: ResidentRecord) {
    const selectedName = getDisplayName(a);
    value = selectedName;
    open = false;
    onSelect?.(a);
    if (isDesktop) {
      tick().then(() => {
        triggerRef?.focus();
      });
    }
  }
  const getSubtitle = (a: ResidentRecord) => {
    if (a.room && a.bed) {
      return `Room ${a.room} · Bed ${a.bed}`;
    }
    if (a.room) {
      return `Room ${a.room}`;
    }
    return a.email;
  };
</script>

{#snippet commandList(inputClass = "")}
  <Command.Root>
    <Command.Input placeholder={searchPlaceholder} class={inputClass} />
    <Command.List>
      <Command.Empty>{emptyMessage}</Command.Empty>
      <Command.Group>
        {#each availableAccounts as a (a.id || a.residentId || a.email)}
          {@const isSelected = value === getDisplayName(a) || value === a.email}
          <Command.Item
            value={`${getDisplayName(a)} ${a.email} ${a.room || ""} ${a.bed || ""} ${a.stno || ""}`}
            onSelect={() => handleSelect(a)}
            class="flex items-center gap-2 py-2"
          >
            <Check class={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-semibold text-foreground">{getDisplayName(a)}</span>
              <span class="truncate text-xs">{getSubtitle(a)}</span>
            </div>
          </Command.Item>
        {/each}
      </Command.Group>
    </Command.List>
  </Command.Root>
{/snippet}

{#snippet triggerButton(props: Record<string, any>, isCombobox = false)}
  <button
    {...props}
    class={cn(
      buttonVariants({ variant: "outline" }),
      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left font-normal",
      !value && "text-muted-foreground"
    )}
    role={isCombobox ? "combobox" : undefined}
    aria-expanded={isCombobox ? open : undefined}
  >
    <span class="truncate">{displayLabel || placeholder}</span>
    <ChevronsUpDown class="h-4 w-4 shrink-0 opacity-50" />
  </button>
{/snippet}

<div class="space-y-1 {className}">
  {#if label}
    <Label>{label}</Label>
  {/if}

  {#if isDesktop}
    <Popover.Root bind:open>
      <Popover.Trigger bind:ref={triggerRef} {disabled} class="block w-full">
        {#snippet child({ props }: { props: Record<string, any> })}
          {@render triggerButton(props, true)}
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-(--bits-popover-anchor-width) p-0" align="start">
        {@render commandList()}
      </Popover.Content>
    </Popover.Root>
  {:else}
    <Drawer.Root bind:open>
      <Drawer.Trigger {disabled} class="block w-full">
        {#snippet child({ props }: { props: Record<string, any> })}
          {@render triggerButton(props)}
        {/snippet}
      </Drawer.Trigger>
      <Drawer.Content>
        <div class="mt-4 border-t px-4 pb-8">
          {@render commandList("my-2")}
        </div>
      </Drawer.Content>
    </Drawer.Root>
  {/if}
</div>
