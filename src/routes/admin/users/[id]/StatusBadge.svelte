<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { getPaymentStatus } from "$lib/resident-logic";
  import type { ResidentRecord as Account } from "$lib/schemas";

  let { account }: { account: Account } = $props();

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
    CLEARED: "bg-primary text-primary-foreground hover:bg-primary/90",
    OVERPAID: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100/80",
    FULLY_PAID: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80",
    HALF_FULLY_PAID: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100/80",
    PARTIALLY_PAID: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100/80",
    NO_PAYMENT: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
    NO_RECORD: "bg-muted text-muted-foreground border-transparent opacity-50"
  };
</script>

<Badge class="font-bold uppercase {styles[status] || styles.NO_RECORD}">
  {labels[status] || status}
</Badge>
