<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { ArrowRight, TrendingUp, TrendingDown, RotateCcwClockIcon } from "@lucide/svelte";
  import { formatCurrency, formatDate } from "$utils/formatters";
  import { translateTransactionType } from "$utils/translators";

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

{#if filteredTransactions.length > 0}
  <div class="mb-6 flex flex-row items-center justify-between pb-0">
    <h2 class="h2-base">Recent Transactions</h2>
    <Button variant="ghost" size="sm" href="/resident/finance" title="View All" icon={ArrowRight} />
  </div>

  <Card.Root class="overflow-hidden p-0">
    <Card.Content class="p-0">
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
                {translateTransactionType(tx.type)}
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
    </Card.Content>
  </Card.Root>
{/if}
