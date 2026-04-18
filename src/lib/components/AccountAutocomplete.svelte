<script lang="ts">
  import { type ResidentRecord } from "$lib/schemas";
  import { Search } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let {
    label,
    placeholder = "Search name or email…",
    accounts = [],
    filter = (a: ResidentRecord) => true,
    value = $bindable(""),
    onSelect,
    class: className = ""
  } = $props<{
    label?: string;
    placeholder?: string;
    accounts: ResidentRecord[];
    filter?: (a: ResidentRecord) => boolean;
    value?: string;
    onSelect: (a: ResidentRecord) => void;
    class?: string;
  }>();

  let showSuggestions = $state(false);

  const filtered = $derived(
    accounts
      .filter(
        (a) =>
          (a.name.toLowerCase().includes(value.toLowerCase()) ||
            a.email.toLowerCase().includes(value.toLowerCase())) &&
          filter(a)
      )
      .slice(0, 5)
  );

  function handleSelect(a: ResidentRecord) {
    onSelect(a);
    value = a.name;
    showSuggestions = false;
  }
</script>

<div class="relative space-y-1 {className}">
  {#if label}
    <Label class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
      >{label}</Label
    >
  {/if}
  <div class="relative">
    <Search class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      {placeholder}
      bind:value
      class="h-9 pl-9 text-xs"
      onfocus={() => (showSuggestions = true)}
      onblur={() => setTimeout(() => (showSuggestions = false), 200)}
    />
  </div>

  {#if showSuggestions && value && filtered.length > 0}
    <div
      class="absolute z-[100] mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-xl"
    >
      {#each filtered as a}
        <button
          onclick={() => handleSelect(a)}
          class="flex w-full flex-col px-4 py-2 text-left text-xs transition-colors hover:bg-muted"
        >
          <span class="font-bold text-foreground">{a.name}</span>
          <span class="text-[10px] text-muted-foreground">{a.email}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
