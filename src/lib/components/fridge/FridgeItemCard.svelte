<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    type FridgeItemRecord,
    FridgeItemStatus,
    FridgeCompartment,
    FRIDGE_TAG_LABELS,
    FRIDGE_TAG_COLORS
  } from "$lib/types";
  import { buttonVariants } from "$ui/button";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import * as Dialog from "$ui/dialog";
  import { cn } from "$lib/utils.js";
  import {
    Snowflake,
    Pencil,
    Trash2,
    LogOut,
    RotateCcw,
    EllipsisVertical,
    Utensils
  } from "@lucide/svelte";

  let {
    item,
    currentResidentId = "",
    isAdmin = false,
    processingId = null,
    onTakeOut,
    onPutBack,
    onDiscard
  }: {
    item: FridgeItemRecord;
    currentResidentId?: string;
    isAdmin?: boolean;
    processingId?: string | null;
    onTakeOut: (item: FridgeItemRecord) => void;
    onPutBack: (item: FridgeItemRecord) => void;
    onDiscard: (item: FridgeItemRecord) => void;
  } = $props();

  const isMine = $derived(item.residentId === currentResidentId);
  const canModify = $derived(isAdmin || isMine);
  const isFreezer = $derived(item.compartment === FridgeCompartment.FREEZER);
  const editUrl = $derived(
    isAdmin ? `/admin/fridge/edit?id=${item.id}` : `/resident/fridge/edit?id=${item.id}`
  );

  function formatDisplayDate(dateStr?: string): string {
    if (!dateStr) {
      return "";
    }
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  function getExpiryInfo(
    expiryDate?: string,
    dateStored?: string
  ): {
    label: string;
    subtext: string;
    colorClass: string;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!expiryDate) {
      let storedSubtext = "Stored today";
      if (dateStored) {
        const stored = new Date(dateStored);
        stored.setHours(0, 0, 0, 0);
        const diffStored = Math.round((today.getTime() - stored.getTime()) / (1000 * 60 * 60 * 24));
        if (diffStored > 0) {
          storedSubtext = `Stored ${diffStored}d ago`;
        }
      }
      return {
        label: storedSubtext,
        subtext: "",
        colorClass: "text-muted-foreground"
      };
    }

    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);

    const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formattedExpDate = formatDisplayDate(expiryDate);

    if (diffDays < 0) {
      return {
        label: `Expired ${formattedExpDate}`,
        subtext: `${Math.abs(diffDays)}d ago`,
        colorClass: "text-destructive font-medium"
      };
    }
    if (diffDays === 0) {
      return {
        label: "Expires today",
        subtext: formattedExpDate,
        colorClass: "text-destructive font-medium"
      };
    }
    if (diffDays <= 3) {
      return {
        label: `Expires ${formattedExpDate}`,
        subtext: `${diffDays} day${diffDays > 1 ? "s" : ""} left`,
        colorClass: "text-amber-500 font-medium"
      };
    }
    return {
      label: `Expires ${formattedExpDate}`,
      subtext: `${diffDays} days left`,
      colorClass: "text-muted-foreground"
    };
  }

  let showImagePreview = $state(false);
  const expiry = $derived(getExpiryInfo(item.expiryDate, item.dateStored));
</script>

<div
  class="flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-border/80"
>
  <div>
    <!-- Top Row: Thumbnail + Title/Status + Action Dropdown -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        {#if item.photoUrl}
          <button
            type="button"
            onclick={() => (showImagePreview = true)}
            class="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-muted transition-transform hover:opacity-90 focus:ring-2 focus:ring-ring focus:outline-hidden active:scale-95"
            title="View photo preview"
          >
            <img src={item.photoUrl} alt={item.name} class="h-full w-full object-cover" />
          </button>
        {:else}
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground"
          >
            {#if isFreezer}
              <Snowflake class="h-6 w-6 text-blue-500" />
            {:else}
              <Utensils class="h-6 w-6 text-muted-foreground" />
            {/if}
          </div>
        {/if}

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <h4 class="truncate text-base leading-snug font-bold text-foreground">
              {item.name}
            </h4>
            {#if isMine}
              <span
                class="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand"
              >
                Mine
              </span>
            {/if}
          </div>
          {#if expiry}
            <div class="flex items-center gap-1.5 text-xs {expiry.colorClass} mt-0.5">
              <span>{expiry.label}</span>
              {#if expiry.subtext}
                <span class="text-muted-foreground/60">•</span>
                <span class="text-muted-foreground">{expiry.subtext}</span>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Action Dropdown Menu -->
      {#if canModify && item.status !== FridgeItemStatus.DISCARDED}
        <div class="shrink-0">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              disabled={processingId === item.id}
              class={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              )}
            >
              <EllipsisVertical class="h-4 w-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              {#if item.status === FridgeItemStatus.STORED}
                <DropdownMenu.Item
                  onclick={() => onTakeOut(item)}
                  disabled={processingId === item.id}
                  class="cursor-pointer"
                >
                  <LogOut class="mr-2 h-4 w-4" />
                  <span>Take out</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item onclick={() => goto(editUrl)} class="cursor-pointer">
                  <Pencil class="mr-2 h-4 w-4" />
                  <span>Edit</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onclick={() => onDiscard(item)}
                  disabled={processingId === item.id}
                  class="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 class="mr-2 h-4 w-4" />
                  <span>Discard</span>
                </DropdownMenu.Item>
              {:else if item.status === FridgeItemStatus.CHECKED_OUT}
                <DropdownMenu.Item
                  onclick={() => onPutBack(item)}
                  disabled={processingId === item.id}
                  class="cursor-pointer"
                >
                  <RotateCcw class="mr-2 h-4 w-4" />
                  <span>Put back in fridge</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onclick={() => onDiscard(item)}
                  disabled={processingId === item.id}
                  class="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 class="mr-2 h-4 w-4" />
                  <span>Discard</span>
                </DropdownMenu.Item>
              {/if}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      {/if}
    </div>

    <!-- Tags list if present -->
    {#if item.tags && item.tags.length > 0}
      <div class="mt-2.5 flex flex-wrap gap-1">
        {#each item.tags as tag}
          <span
            class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium {FRIDGE_TAG_COLORS[
              tag
            ] || FRIDGE_TAG_COLORS.DEFAULT}"
          >
            {FRIDGE_TAG_LABELS[tag] || tag}
          </span>
        {/each}
      </div>
    {/if}

    <!-- Bottom Details: Multi-row metadata -->
    <div class="mt-3.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
      <div class="flex items-center justify-between font-medium text-foreground/90">
        <span>Stored on {formatDisplayDate(item.dateStored)}</span>
        <span>
          {item.locationDetails || (isFreezer ? "Freezer" : "Fridge")}
        </span>
      </div>

      {#if item.residentName}
        <div class="flex items-center justify-between text-muted-foreground">
          <span class="truncate">{item.residentName}</span>
          {#if item.room}
            <span class="shrink-0">Room {item.room}</span>
          {/if}
        </div>
      {/if}

      {#if (item.status === FridgeItemStatus.CHECKED_OUT || item.status === FridgeItemStatus.DISCARDED) && item.actionBy && item.actionBy !== item.residentId}
        <div
          class="flex items-center justify-between pt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
        >
          <span>
            {item.status === FridgeItemStatus.DISCARDED ? "Discarded by" : "Taken out by"}
            {item.actionByName || item.actionBy}
          </span>
          {#if item.checkOutDate}
            <span class="shrink-0 text-muted-foreground"
              >{formatDisplayDate(item.checkOutDate)}</span
            >
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if item.photoUrl}
  <Dialog.Root bind:open={showImagePreview}>
    <Dialog.Content
      class="max-w-lg overflow-hidden border bg-card/95 p-3 shadow-lg backdrop-blur-sm"
    >
      <Dialog.Header class="px-2 pt-1 pb-2">
        <Dialog.Title class="truncate text-base font-bold">{item.name}</Dialog.Title>
        <Dialog.Description class="text-xs text-muted-foreground">
          {item.locationDetails || (isFreezer ? "Freezer" : "Refrigerator")} • Stored on {formatDisplayDate(
            item.dateStored
          )}
        </Dialog.Description>
      </Dialog.Header>
      <div
        class="relative flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-lg bg-black/5"
      >
        <img
          src={item.photoUrl}
          alt={item.name}
          class="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
        />
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
