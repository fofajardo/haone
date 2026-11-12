<script lang="ts">
  import { formatAccounting } from "$utils/formatters";
  import { translateTransactionType } from "$utils/translators";
  import { getJournalActiveItems, type JournalRecord, type PaymentRequestRecord } from "$lib/types";

  let {
    record,
    variant
  }: {
    record: JournalRecord | PaymentRequestRecord;
    variant: "account" | "composition" | "mop" | "total";
  } = $props();

  const activeItems = $derived(getJournalActiveItems(record));
</script>

<div class="flex flex-col">
  {#if variant === "account"}
    <div class="flex flex-col">
      <span class="font-medium">{"name" in record ? record.name : ""}</span>
      <span class="text-muted-foreground">{translateTransactionType(record.type)}</span>
    </div>
  {:else if variant === "total"}
    <div class="text-right">
      <span class="">{formatAccounting("amount" in record ? record.amount : 0)}</span>
    </div>
  {:else if variant === "mop"}
    <div class="flex flex-col">
      <span class="">{record.mop}</span>
      <span class="text-muted-foreground"
        >{"mopRefNo" in record && record.mopRefNo && record.mopRefNo !== "N/A"
          ? record.mopRefNo
          : "No Reference Code"}</span
      >
    </div>
  {:else}
    {#each activeItems as fee}
      <div class="flex items-center justify-between">
        <span class="">{fee.name}</span>
        <span class="text-right">{formatAccounting(fee.amount)}</span>
      </div>
    {/each}
  {/if}
</div>
