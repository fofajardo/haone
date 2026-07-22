<script lang="ts">
  import { Badge } from "$ui/badge";
  import { getPaymentStatus } from "$api/controllers/resident-controller";
  import type { ResidentRecord as Account } from "$lib/types";

  let { account, textOnly = false }: { account: Account; textOnly?: boolean } = $props();

  const status = $derived(getPaymentStatus(account));

  const labels: Record<string, string> = {
    CLEARED: "CLEARED",
    OVERPAID: "OVERPAID",
    FULLY_PAID: "FULLY PAID",
    HALF_FULLY_PAID: "HALF-FULLY PAID",
    PARTIALLY_PAID: "PARTIAL",
    NO_PAYMENT: "NO PAYMENT",
    NO_RECORD: "NO RECORD"
  };

  const styles: Record<string, string> = {
    CLEARED: "bg-primary text-primary-foreground",
    OVERPAID: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200/20",
    FULLY_PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/20",
    HALF_FULLY_PAID: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/20",
    PARTIALLY_PAID: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200/20",
    NO_PAYMENT: "bg-destructive/15 text-destructive border-destructive/20",
    NO_RECORD: "bg-muted text-muted-foreground border-transparent opacity-50"
  };

  const textColors: Record<string, string> = {
    CLEARED: "text-foreground",
    OVERPAID: "text-blue-600 dark:text-blue-400",
    FULLY_PAID: "text-emerald-600 dark:text-emerald-400",
    HALF_FULLY_PAID: "text-amber-600 dark:text-amber-400",
    PARTIALLY_PAID: "text-orange-600 dark:text-orange-400",
    NO_PAYMENT: "text-destructive",
    NO_RECORD: "text-muted-foreground"
  };
</script>

{#if textOnly}
  <p
    class="text-3xl font-semibold tracking-tight uppercase {textColors[status] ||
      textColors.NO_RECORD}"
  >
    {labels[status] || status}
  </p>
{:else}
  <Badge class="uppercase {styles[status] || styles.NO_RECORD}">
    {labels[status] || status}
  </Badge>
{/if}
