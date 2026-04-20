<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import {
    RefreshCcw,
    Wallet,
    ShieldCheck,
    MapPin,
    ArrowRight,
    History,
    TrendingUp,
    TrendingDown
  } from "lucide-svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { formatCurrency, translatePeriod, translateType, formatDate } from "$lib/receipt-utils";
  import { pageState } from "$lib/page-info.svelte";
  import StatusBadge from "$lib/components/residents/StatusBadge.svelte";
  import { fetchServer } from "$lib/utils";

  let status = $state<any>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadStatus(term?: string) {
    if (!auth.user?.email) return;
    isLoading = true;
    error = null;
    try {
      const targetTerm = term || status?.activeTerm || "";
      status = await fetchServer(`/api/resident/check-status?term=${targetTerm}`);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Resident Dashboard";
    if (auth.accessToken && !status) {
      loadStatus();
    }
  });
</script>

<div class="space-y-12 pb-12">
  <!-- Hero Section -->
  <div
    class="relative overflow-hidden rounded-3xl bg-brand px-4 py-8 text-brand-foreground shadow-2xl sm:px-8 sm:py-12"
  >
    <div
      class="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
    ></div>
    <div
      class="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
    ></div>

    <div class="relative z-10 space-y-4">
      <div
        class="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-white/60 uppercase"
      ></div>
      <h1 class="text-4xl font-black tracking-tight text-brand-foreground md:text-5xl lg:text-6xl">
        Welcome back, <span class="text-brand-foreground"
          >{auth.user?.name?.split(" ")[0] || "Resident"}</span
        >
      </h1>
      <p class="max-w-[600px] text-lg text-brand-foreground md:text-xl">
        View your profile, track your financial standing, and manage your clearance for <span
          class="font-semibold text-brand-foreground"
          >{translatePeriod(status?.activeTerm || status?.systemActiveTerm) || "Active Term"}</span
        >.
      </p>
    </div>

    <div class="absolute top-4 right-4 z-20">
      <Button
        variant="ghost"
        size="icon"
        class="h-10 w-10 rounded-xl text-white/50 transition-all hover:bg-white/10 hover:text-white"
        onclick={() => loadStatus()}
        disabled={isLoading}
      >
        <RefreshCcw class="h-5 w-5 {isLoading ? 'animate-spin' : ''}" />
      </Button>
    </div>
  </div>

  {#if isLoading && !status}
    <LoadingView text="Loading dashboard…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadStatus()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else if status}
    <!-- Quick Stats Grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Amount Due -->
      <Card.Root
        class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg"
      >
        <Card.Content class="px-4 py-0 sm:px-6">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Amount Due
              </p>
              <h3 class="text-3xl font-black text-foreground">
                {formatCurrency(status.account?.bal || 0)}
              </h3>
            </div>
            <div class="rounded-2xl bg-brand/5 p-3 text-brand">
              <Wallet class="h-6 w-6" />
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Payment Status -->
      <Card.Root
        class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg"
      >
        <Card.Content class="px-4 py-0 sm:px-6">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Payment Status
              </p>
              <div class="pt-1">
                <StatusBadge account={status.account} />
              </div>
            </div>
            <div class="rounded-2xl bg-brand/5 p-3 text-brand">
              <ShieldCheck class="h-6 w-6" />
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Room Assignment -->
      <Card.Root
        class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg"
      >
        <Card.Content class="px-4 py-0 sm:px-6">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Room & Bed
              </p>
              <h3 class="text-3xl font-black text-foreground">
                {status.account?.room}-{status.account?.bed}
              </h3>
            </div>
            <div class="rounded-2xl bg-brand/5 p-3 text-brand">
              <MapPin class="h-6 w-6" />
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <div class="grid gap-8 lg:grid-cols-3">
      <!-- Quick Access Section -->
      <div class="lg:col-span-2">
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-xl font-bold text-foreground">Quick Access</h2>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <a
            href="/resident/finance"
            class="group relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-all duration-300 hover:border-brand/50 hover:shadow-xl"
          >
            <div class="w-fit rounded-xl bg-brand/10 p-2.5 text-brand">
              <Wallet class="h-6 w-6" />
            </div>
            <div>
              <h3 class="font-bold text-foreground">Finance</h3>
              <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                View your financial standing and history.
              </p>
            </div>
            <div
              class="absolute right-5 bottom-5 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            >
              <ArrowRight class="h-5 w-5 text-brand" />
            </div>
          </a>

          <a
            href="/resident/occupancy"
            class="group relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-all duration-300 hover:border-brand/50 hover:shadow-xl"
          >
            <div class="w-fit rounded-xl bg-brand/10 p-2.5 text-brand">
              <MapPin class="h-6 w-6" />
            </div>
            <div>
              <h3 class="font-bold text-foreground">Occupancy</h3>
              <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                Track your past room assignments.
              </p>
            </div>
            <div
              class="absolute right-5 bottom-5 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            >
              <ArrowRight class="h-5 w-5 text-brand" />
            </div>
          </a>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div>
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-xl font-bold text-foreground">Recent Activity</h2>
          <Button variant="ghost" size="icon" href="/resident/finance" title="View All">
            <ArrowRight class="h-4 w-4" />
          </Button>
        </div>
        <Card.Root class="overflow-hidden border-none bg-card p-0 shadow-md">
          <Card.Content class="divide-y p-0">
            {#if status.transactions?.filter((t: any) => t.period === status.activeTerm).length > 0}
              {#each status.transactions
                .filter((t: any) => t.period === status.activeTerm)
                .slice(0, 5) as tx}
                <div
                  class="group flex items-start gap-3 p-3 transition-colors hover:bg-muted/50 sm:items-center sm:gap-4 sm:p-4"
                >
                  <div
                    class="shrink-0 rounded-full p-2.5 transition-colors group-hover:bg-card group-hover:shadow-sm {tx.amount >
                    0
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
                      <History class="h-4 w-4" />
                    {/if}
                  </div>

                  <div class="flex min-w-0 flex-1 items-center justify-between">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-bold text-foreground">
                        {translateType(tx.type, status.transactionTypes)}
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
                <History class="mb-2 h-8 w-8 text-muted-foreground/30" />
                <p class="text-sm font-medium text-muted-foreground">No recent transactions</p>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>
