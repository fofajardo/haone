<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { Check, Clock, TriangleAlert, CircleAlert, ShieldCheck } from "@lucide/svelte";
  import { type ResidentRecord as Resident } from "$lib/schemas";

  let { resident }: { resident: Resident } = $props();
</script>

<div class="flex items-center justify-center gap-1.5">
  {#if resident.ceIssued && resident.ceIssued !== "" && resident.ceIssued !== "#N/A"}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Badge variant="outline" class="border-brand/20 bg-brand/10 p-1.5 text-brand">
          <ShieldCheck class="h-3.5 w-3.5" />
        </Badge>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p class="font-bold">Cleared on {resident.ceIssued}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}

  {#if resident.isFullyPaid}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Badge
          variant="outline"
          class="border-emerald-500/20 bg-emerald-500/10 p-1.5 text-emerald-600"
        >
          <Check class="h-3.5 w-3.5" />
        </Badge>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p class="font-bold">Fully Paid</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {:else}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Badge variant="outline" class="border-sky-500/20 bg-sky-500/10 p-1.5 text-sky-600">
          <Clock class="h-3.5 w-3.5" />
        </Badge>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p class="font-bold">Pending Payment</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}

  {#if resident.bal < 0}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Badge variant="outline" class="border-amber-500/20 bg-amber-500/10 p-1.5 text-amber-600">
          <TriangleAlert class="h-3.5 w-3.5" />
        </Badge>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p class="font-bold">Overpaid: Account balance is negative</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}

  {#if resident.bal === 0 && (resident.waterBal < 0 || resident.assocBal < 0)}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Badge variant="outline" class="border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-600">
          <CircleAlert class="h-3.5 w-3.5" />
        </Badge>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p class="font-bold">Misassigned: Internal balances are negative</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}
</div>
