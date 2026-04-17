<script lang="ts">
  import { formatAmount } from "$lib/receipt-utils";
  import type { JournalRecord } from "$lib/schemas";

  let {
    record,
    variant
  }: { record: JournalRecord; variant: "account" | "composition" | "mop" | "total" } = $props();

  const activeItems = $derived(
    [
      { name: "Water Fee", amount: record.water },
      { name: "Association Fee", amount: record.assoc },
      { name: "Miscellaneous", amount: record.misc }
    ].filter((i) => i.amount !== 0)
  );
</script>

<div class="flex flex-col">
  {#if variant === "account"}
    <div class="flex flex-col">
      <span class="font-medium">{record.name}</span>
      <span class="text-muted-foreground">{record.type}</span>
    </div>
  {:else if variant === "total"}
    <div class="text-right">
      <span class=""
        >{record.amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span
      >
    </div>
  {:else if variant === "mop"}
    <div class="flex flex-col">
      <span class="">{record.mop}</span>
      <span class="text-muted-foreground"
        >{record.mopRefNo === "N/A" || !record.mopRefNo
          ? "No Reference Code"
          : record.mopRefNo}</span
      >
    </div>
  {:else}
    {#each activeItems as fee}
      <div class="flex items-center justify-between">
        <span class="">{fee.name}</span>
        <span class="text-right">{formatAmount(fee.amount)}</span>
      </div>
    {/each}
  {/if}
</div>
