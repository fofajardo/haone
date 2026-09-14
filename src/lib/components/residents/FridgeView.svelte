<script lang="ts">
  import {
    type FridgeItemRecord,
    FridgeItemStatus,
    FridgeCompartment,
    FRIDGE_TAG_LABELS
  } from "$lib/types";
  import * as InputGroup from "$ui/input-group";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import FridgeItemCard from "$components/residents/FridgeItemCard.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Refrigerator, Search } from "@lucide/svelte";

  let {
    items = [],
    currentResidentId = "",
    isAdmin = false,
    processingId = null,
    onTakeOut,
    onPutBack,
    onDiscard
  }: {
    items: FridgeItemRecord[];
    currentResidentId: string;
    isAdmin?: boolean;
    processingId?: string | null;
    onTakeOut: (item: FridgeItemRecord) => void;
    onPutBack: (item: FridgeItemRecord) => void;
    onDiscard: (item: FridgeItemRecord) => void;
  } = $props();

  let searchQuery = $state("");
  let filterCategory = $state<string>("ALL");

  const filterOptions = [
    { value: "ALL", label: "All Active Items" },
    { value: "REFRIGERATOR", label: "Refrigerator" },
    { value: "FREEZER", label: "Freezer" },
    { value: "EXPIRED", label: "Expired Soon/Expired" },
    { value: "TAKEN_OUT", label: "Taken Out" },
    { value: "DISCARDED", label: "Discarded" }
  ];

  const activeItems = $derived(items.filter((i) => i.status === FridgeItemStatus.STORED));

  const filteredItems = $derived.by(() => {
    let list = activeItems;

    if (filterCategory === "REFRIGERATOR") {
      list = activeItems.filter((i) => i.compartment === FridgeCompartment.REFRIGERATOR);
    } else if (filterCategory === "FREEZER") {
      list = activeItems.filter((i) => i.compartment === FridgeCompartment.FREEZER);
    } else if (filterCategory === "EXPIRED") {
      list = activeItems.filter((i) => {
        if (!i.expiryDate) {
          return false;
        }
        const exp = new Date(i.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return exp <= today || (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 3;
      });
    } else if (filterCategory === "TAKEN_OUT") {
      list = items.filter((i) => i.status === FridgeItemStatus.CHECKED_OUT);
    } else if (filterCategory === "DISCARDED") {
      list = items.filter((i) => i.status === FridgeItemStatus.DISCARDED);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.residentName || "").toLowerCase().includes(q) ||
          (i.room || "").toLowerCase().includes(q) ||
          (i.locationDetails || "").toLowerCase().includes(q) ||
          (i.notes || "").toLowerCase().includes(q) ||
          (i.tags || []).some((t) => (FRIDGE_TAG_LABELS[t] || t).toLowerCase().includes(q))
      );
    }

    return list;
  });

  const filteredUserItems = $derived.by(() => {
    if (!currentResidentId) {
      return [];
    }
    return filteredItems.filter((i) => i.residentId === currentResidentId);
  });

  const filteredOtherItems = $derived.by(() => {
    if (!currentResidentId) {
      return filteredItems;
    }
    return filteredItems.filter((i) => i.residentId !== currentResidentId);
  });
</script>

{#snippet fridgeItemGrid(gridItems: FridgeItemRecord[])}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each gridItems as item (item.id)}
      <FridgeItemCard
        {item}
        {currentResidentId}
        {isAdmin}
        {processingId}
        {onTakeOut}
        {onPutBack}
        {onDiscard}
      />
    {/each}
  </div>
{/snippet}

<FilterDrawer activeCount={Number(searchQuery !== "") + Number(filterCategory !== "ALL")}>
  <div class="grid items-end gap-4 lg:grid-cols-12">
    <div class="space-y-1 lg:col-span-8">
      <Label>Search</Label>
      <InputGroup.Root class="h-9">
        <InputGroup.Input
          bind:value={searchQuery}
          placeholder="Search items, owner, room, tags, location…"
        />
        <InputGroup.Addon>
          <Search />
        </InputGroup.Addon>
      </InputGroup.Root>
    </div>

    <div class="space-y-1 lg:col-span-4">
      <Label>Category</Label>
      <Combobox
        bind:value={filterCategory}
        options={filterOptions}
        placeholder="Select category..."
        class="h-9"
      />
    </div>
  </div>
</FilterDrawer>

<!-- Items Grid -->
{#if filteredItems.length === 0}
  <EmptyView
    title="No fridge items found"
    description={searchQuery || filterCategory !== "ALL"
      ? "Try adjusting your search query or category filter."
      : "Items stored in the refrigerator or freezer will appear here."}
  >
    {#snippet icon()}
      <Refrigerator class="h-10 w-10 text-muted-foreground" />
    {/snippet}
  </EmptyView>
{:else}
  <h2 class="text-lg font-semibold text-foreground/80">My Items</h2>
  {#if filteredUserItems.length === 0}
    <EmptyView
      title="No fridge items found"
      description={searchQuery || filterCategory !== "ALL"
        ? "Try adjusting your search query or category filter."
        : "Items you have stored in the refrigerator or freezer will appear here."}
    >
      {#snippet icon()}
        <Refrigerator class="h-10 w-10 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    {@render fridgeItemGrid(filteredUserItems)}
  {/if}

  <h2 class="text-lg font-semibold text-foreground/80">Other Items</h2>
  {#if filteredOtherItems.length === 0}
    <EmptyView
      title="No fridge items found"
      description={searchQuery || filterCategory !== "ALL"
        ? "Try adjusting your search query or category filter."
        : "Items stored in the refrigerator or freezer by other residents will appear here."}
    >
      {#snippet icon()}
        <Refrigerator class="h-10 w-10 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    {@render fridgeItemGrid(filteredOtherItems)}
  {/if}
{/if}
