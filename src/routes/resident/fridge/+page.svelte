<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import {
    fetchFridgeItems,
    checkOutFridgeItem,
    restoreFridgeItem,
    discardFridgeItem
  } from "$api/controllers/fridge-controller";
  import {
    type FridgeItemRecord,
    FridgeItemStatus,
    FridgeCompartment,
    FRIDGE_TAG_LABELS
  } from "$lib/types";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import * as AlertDialog from "$ui/alert-dialog";
  import ContentHeader from "$components/ContentHeader.svelte";
  import FridgeItemCard from "$components/fridge/FridgeItemCard.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import { Checkbox } from "$ui/checkbox";
  import { toast } from "svelte-sonner";
  import { Refrigerator, Plus, Search } from "@lucide/svelte";

  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let items = $state<FridgeItemRecord[]>([]);
  let currentResidentId = $state("");
  let searchQuery = $state("");
  let filterCategory = $state<string>("ALL");
  let showOnlyMine = $state(true);
  let processingId = $state<string | null>(null);
  let isActionLoading = $state(false);

  const filterOptions = [
    { value: "ALL", label: "All Active Items" },
    { value: "REFRIGERATOR", label: "Refrigerator" },
    { value: "FREEZER", label: "Freezer" },
    { value: "EXPIRED", label: "Expired Soon/Expired" },
    { value: "TAKEN_OUT", label: "Taken Out" },
    { value: "DISCARDED", label: "Discarded" }
  ];

  let confirmActionDialog = $state({
    open: false,
    title: "",
    description: "",
    action: async () => {}
  });

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      const res = await fetchFridgeItems(bypassCache);
      items = res.items;
      currentResidentId = res.currentResidentId;
    } catch (e: any) {
      error = e.message || "Failed to load fridge items.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Fridge";
    loadData();
  });

  const activeItems = $derived(items.filter((i) => i.status === FridgeItemStatus.STORED));

  const filteredItems = $derived.by(() => {
    let list = activeItems;

    if (filterCategory === "REFRIGERATOR") {
      list = activeItems.filter((i) => i.compartment === FridgeCompartment.REFRIGERATOR);
    } else if (filterCategory === "FREEZER") {
      list = activeItems.filter((i) => i.compartment === FridgeCompartment.FREEZER);
    } else if (filterCategory === "EXPIRED") {
      list = activeItems.filter((i) => {
        if (!i.expiryDate) return false;
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

    if (showOnlyMine && currentResidentId) {
      list = list.filter((i) => i.residentId === currentResidentId);
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

  async function handleTakeOut(item: FridgeItemRecord) {
    processingId = item.id;
    try {
      await checkOutFridgeItem(item.id, currentResidentId);
      toast.success(`Took out ${item.name}!`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to check out item.");
    } finally {
      processingId = null;
    }
  }

  async function handlePutBack(item: FridgeItemRecord) {
    processingId = item.id;
    try {
      await restoreFridgeItem(item, currentResidentId);
      toast.success(`Returned ${item.name} back to fridge!`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to return item to fridge.");
    } finally {
      processingId = null;
    }
  }

  function confirmDiscard(item: FridgeItemRecord) {
    confirmActionDialog = {
      open: true,
      title: "Discard Item?",
      description: `Are you sure you want to mark "${item.name}" as discarded? Its photo will be permanently deleted and it cannot be restored.`,
      action: async () => {
        processingId = item.id;
        try {
          await discardFridgeItem(item.id, currentResidentId);
          toast.success("Item marked as discarded.");
          await loadData();
        } catch (e: any) {
          toast.error(e.message || "Failed to discard item.");
        } finally {
          processingId = null;
        }
      }
    };
  }
</script>

<div class="mx-auto max-w-7xl space-y-4 pb-16">
  <ContentHeader
    title="Fridge"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <Button size="sm" href="/resident/fridge/add" icon={Plus}>Add</Button>
    {/snippet}
  </ContentHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error} />
  {:else}
    <FilterDrawer
      activeCount={Number(searchQuery !== "") +
        Number(filterCategory !== "ALL") +
        Number(!showOnlyMine)}
    >
      <div class="grid items-end gap-4 lg:grid-cols-12">
        <div class="space-y-1 lg:col-span-5">
          <Label>Search</Label>
          <div class="relative">
            <Search
              class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={searchQuery}
              placeholder="Search items, owner, room, tags, location…"
              class="h-9 pl-9"
            />
          </div>
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

        <div class="flex h-9 items-center space-x-2 lg:col-span-3 lg:justify-end">
          <Checkbox id="show-only-mine" bind:checked={showOnlyMine} />
          <Label
            for="show-only-mine"
            class="cursor-pointer text-sm leading-none font-medium select-none"
          >
            Show only my items
          </Label>
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
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each filteredItems as item (item.id)}
          <FridgeItemCard
            {item}
            {currentResidentId}
            isAdmin={false}
            {processingId}
            onTakeOut={handleTakeOut}
            onPutBack={handlePutBack}
            onDiscard={confirmDiscard}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<AlertDialog.Root
  open={confirmActionDialog.open}
  onOpenChange={(v) => {
    if (!isActionLoading) {
      confirmActionDialog.open = v;
    }
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{confirmActionDialog.title}</AlertDialog.Title>
      <AlertDialog.Description>{confirmActionDialog.description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isActionLoading}>Cancel</AlertDialog.Cancel>
      <Button
        variant="destructive"
        isLoading={isActionLoading}
        disabled={isActionLoading}
        onclick={async () => {
          isActionLoading = true;
          try {
            await confirmActionDialog.action();
            confirmActionDialog.open = false;
          } finally {
            isActionLoading = false;
          }
        }}
      >
        Discard
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
