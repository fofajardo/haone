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
    TrendingDown,
    WashingMachine,
    Banknote,
    Trophy,
    House,
    Settings,
    Megaphone,
    BookUser,
    Network
  } from "@lucide/svelte";
  import AnnouncementsSection from "$lib/components/residents/AnnouncementsSection.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { formatCurrency, translatePeriod, translateType, formatDate } from "$lib/receipt-utils";
  import { pageState } from "$lib/page-info.svelte";
  import StatusBadge from "$lib/components/residents/StatusBadge.svelte";
  import DashboardActionCard from "$lib/components/DashboardActionCard.svelte";
  import { fetchServer } from "$lib/utils";
  import type { ResidentStatus } from "$lib/resident-state.svelte";
  import { AccountType } from "$lib/schemas";
  import StatisticCard from "$lib/components/StatisticCard.svelte";

  let status = $state<ResidentStatus | null>(null);
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

  const actions: any[] = [
    {
      title: "Finance",
      description: "View your financial standing and history.",
      href: "/resident/finance",
      icon: Wallet,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Laundry",
      description: "Book and manage your laundry reservations.",
      href: "/resident/laundry",
      icon: WashingMachine,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Payment Requests",
      description: "Upload your transaction entries for verification.",
      href: "/resident/payment-requests",
      icon: Banknote,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Announcements",
      description: "View updates and announcements from house council officers.",
      href: "/resident/announcements",
      icon: Megaphone,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Static IP Address",
      description: "Request and manage your room network configuration.",
      href: "/resident/static-ip",
      icon: Network,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Achievements",
      description: "View your earned achievements and leaderboard.",
      href: "/resident/achievements",
      icon: Trophy,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Occupancy",
      description: "View your current room details and history.",
      href: "/resident/occupancy",
      icon: House,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Officers",
      description: "View profiles and contacts of house council officers.",
      href: "/resident/officers",
      icon: BookUser,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Settings",
      description: "Customize your profile and application preferences.",
      href: "/resident/settings",
      icon: Settings,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    }
  ];

  onMount(() => {
    pageState.title = "Resident Dashboard";
    if (auth.accessToken && !status) {
      loadStatus();
    }
  });
</script>

<div class="space-y-6 pb-12">
  <!-- Hero Section -->
  <div
    class="relative overflow-hidden rounded-3xl bg-brand/10 px-4 py-8 text-brand sm:px-8 sm:py-12"
  >
    <div class="relative z-10 space-y-4">
      <div class="flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase"></div>
      <h1 class="text-4xl font-black tracking-tight md:text-5xl lg:text-6xl">
        Welcome back, {auth.user?.name?.split(" ")[0] || "Resident"}
      </h1>
      <p class="text-lg text-brand md:text-xl">
        View your profile, track your financial standing, and manage your clearance for <span
          class="font-semibold text-brand"
          >{translatePeriod(status?.activeTerm || status?.systemActiveTerm) || "Active Term"}</span
        >.
      </p>
    </div>

    <div class="absolute top-4 right-4 z-20">
      <Button
        variant="ghost"
        size="icon"
        class="h-10 w-10 rounded-xl text-brand/50 transition-all hover:bg-brand/10 hover:text-brand"
        onclick={() => loadStatus()}
        {isLoading}
        icon={RefreshCcw}
      />
    </div>
  </div>

  {#if isLoading && !status}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadStatus()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else if status}
    <!-- Quick Stats Grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#if status.account && status.currEntry?.accountType !== AccountType.ALUMNUS}
        <StatisticCard
          title="Amount Due"
          value={formatCurrency(status.account?.bal || 0)}
          {isLoading}
        >
          {#snippet icon()}<Wallet class="h-6 w-6" />{/snippet}
        </StatisticCard>

        <StatisticCard title="Payment Status" value="" {isLoading}>
          {#snippet icon()}<ShieldCheck class="h-6 w-6" />{/snippet}
          <StatusBadge account={status.account} textOnly={true} />
        </StatisticCard>

        <StatisticCard
          title="Room & Bed"
          value={`${status.account?.room}-${status.account?.bed}`}
          {isLoading}
        >
          {#snippet icon()}<MapPin class="h-6 w-6" />{/snippet}
        </StatisticCard>
      {/if}
    </div>

    <div class="grid gap-8 lg:grid-cols-3 min-w-0">
      <!-- Announcements Section (2 cols) -->
      <div class="lg:col-span-2 min-w-0">
        <AnnouncementsSection />
      </div>

      <!-- Recent Transactions (1 col) -->
      <div class="space-y-4 min-w-0">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-foreground">Recent Activity</h2>
          <Button variant="ghost" size="sm" href="/resident/finance" title="View All">
            View All <ArrowRight class="ml-1 h-4 w-4" />
          </Button>
        </div>
        <Card.Root class="overflow-hidden bg-card shadow-none">
          <Card.Content class="divide-y p-6">
            {#if status.transactions?.filter((t: any) => t.period === status?.activeTerm).length > 0}
              {#each status.transactions
                .filter((t: any) => t.period === status?.activeTerm)
                .slice(0, 5) as tx}
                <div
                  class="group flex items-start gap-3 py-3.5 px-0 transition-colors hover:bg-muted/50 sm:items-center sm:gap-4"
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

    <!-- Quick Access Section (3 cols) -->
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-foreground">Quick Access</h2>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each actions as tool}
          <DashboardActionCard {...tool} />
        {/each}
      </div>
    </div>
  {/if}
</div>
