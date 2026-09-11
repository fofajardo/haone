<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { ArrowRight, TrendingUp, TrendingDown, RotateCcwClockIcon } from "@lucide/svelte";
  import { formatCurrency, formatDate } from "$utils/formatters";
  import { translatePaymentType } from "$utils/translators";

  let {
    transactions = [],
    period = ""
  }: {
    transactions?: any[];
    period?: string;
  } = $props();

  const filteredTransactions = $derived(
    transactions.filter((t: any) => t.period === period).slice(0, 5)
  );
</script>

<Card.Root class="overflow-hidden bg-card shadow-none">
  <Card.Header class="flex flex-row items-center justify-between pb-0">
    <Card.Title>Recent Activity</Card.Title>
    <Card.Action>
      <Button variant="ghost" href="/resident/finance" title="View All" icon={ArrowRight} />
    </Card.Action>
  </Card.Header>
  <Card.Content class="p-0">
    {#if filteredTransactions.length > 0}
      {#each filteredTransactions as tx}
        <div
          class="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50 sm:items-center sm:gap-4"
        >
          <div
            class="shrink-0 rounded-full p-2.5 transition-colors {tx.amount > 0
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : tx.amount < 0
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-brand/5 text-brand'}"
          >
            {#if tx.amount > 0}
              <TrendingUp class="h-4 w-4" />
            {:else if tx.amount < 0}
              <TrendingDown class="h-4 w-4" />
            {:else}
              <RotateCcwClockIcon class="h-4 w-4" />
            {/if}
          </div>

          <div class="flex min-w-0 flex-1 items-center justify-between">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-foreground">
                {translatePaymentType(tx.type)}
              </p>
              <p class="truncate text-xs font-bold text-muted-foreground uppercase">
                {formatDate(tx.date)}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-mono text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(tx.amount)}
              </p>
            </div>
          </div>
        </div>
      {/each}
    {:else}
      <div class="flex h-40 flex-col items-center justify-center p-8 text-center">
        <RotateCcwClockIcon class="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p class="text-sm font-medium text-muted-foreground">No recent transactions</p>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
