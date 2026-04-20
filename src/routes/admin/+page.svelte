<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import {
    Mail,
    ArrowRight,
    Users,
    Receipt,
    ChartPie,
    Settings,
    History,
    TrendingUp,
    TrendingDown,
    Clock,
    ListFilter,
    CircleCheck,
    FileSpreadsheet
  } from "lucide-svelte";
  import { auth } from "$lib/auth.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { formatCurrency, formatDate, translatePeriod, translateType } from "$lib/receipt-utils";
  import { mapRowToJournal, fetchResidents } from "$lib/resident-logic";
  import { onMount } from "svelte";

  let stats = $state({
    activeResidents: 0,
    pendingSettlements: 0,
    totalCollected: 0,
    collectionRate: 0
  });

  let recentTransactions = $state<any[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);

  const tools = [
    {
      title: "Pending Receipts",
      description: "Review pending payments and generate secure receipts.",
      href: "/admin/pending",
      icon: Receipt,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Email Dispatcher",
      description: "Batch send receipts to residents via Gmail API.",
      href: "/admin/email-dispatcher",
      icon: Mail,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Residents",
      description: "Manage resident profiles, rooms, and balances.",
      href: "/admin/residents",
      icon: Users,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Transactions",
      description: "Full transaction history and manual entry management.",
      href: "/admin/transactions",
      icon: ListFilter,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Demographics",
      description: "Analyze resident distribution and historical trends.",
      href: "/admin/reports/demographics",
      icon: ChartPie,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Reports",
      description: "Generate collection summaries, financial statements, and resident rosters.",
      href: "/admin/reports",
      icon: FileSpreadsheet,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    },
    {
      title: "Settings",
      description: "Personalize your interface, manage accessibility, and view system information.",
      href: "/admin/settings",
      icon: Settings,
      color: "text-brand",
      bg: "bg-brand/10",
      border: "hover:border-brand/50"
    }
  ];

  async function loadDashboardData() {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;

    try {
      const [journalRows, allResidents, constRows] = await Promise.all([
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "journal_general!A:T"),
        fetchResidents(),
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C")
      ]);

      transactionTypes = constRows
        .slice(1)
        .filter((r) => (r[0] || "").startsWith("PMT_"))
        .map((r) => ({
          value: r[1] || r[0],
          label: r[2] || r[1] || r[0]
        }));

      // Stats from Accounts
      const currentSem = uiSettings.currentSemester.trim();
      const accounts = allResidents.filter(
        (r) => r.period === currentSem && r.email && r.email !== "_vacant"
      );

      stats.activeResidents = accounts.length;

      const fullyPaidCount = accounts.filter((r) => r.isFullyPaid).length;
      stats.collectionRate =
        stats.activeResidents > 0 ? (fullyPaidCount / stats.activeResidents) * 100 : 0;

      // Stats from Journal
      const journalData = journalRows.slice(1).map((r, idx) => mapRowToJournal(r, idx));
      const pending = journalData.filter((r) => {
        return (
          r.period === currentSem &&
          (!r.prDateIssued || r.prDateIssued === "#N/A") &&
          r.prRefNo !== "N/A" &&
          r.prRefNo !== "#N/A"
        );
      });
      stats.pendingSettlements = pending.length;

      // Total Collected in Semester
      stats.totalCollected = accounts.reduce((sum, r) => sum + r.paid, 0);

      // Recent Transactions (last 5)
      recentTransactions = journalData
        .filter((r) => r.period === currentSem)
        .slice(-5)
        .reverse();
    } catch (e) {
      console.error("Dashboard load failed", e);
    } finally {
      isLoading = false;
    }
  }

  onMount(loadDashboardData);
</script>

<div class="space-y-12 pb-12">
  <!-- Header Section -->
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
        Welcome back, <span class="text-brand-foreground">{auth.user?.name.split(" ")[0]}</span>
      </h1>
      <p class="max-w-[600px] text-lg text-brand-foreground md:text-xl">
        Manage residents, track collections, and automate communications for <span
          class="font-semibold text-brand-foreground"
          >{translatePeriod(uiSettings.currentSemester) || "Active Term"}</span
        >.
      </p>
    </div>
  </div>

  <!-- Quick Stats -->
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <Card.Root class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg">
      <Card.Content class="px-4 py-0 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Active Residents
            </p>
            {#if isLoading}
              <div class="h-9 w-16 animate-pulse rounded bg-muted/50"></div>
            {:else}
              <h3 class="text-3xl font-black text-foreground">{stats.activeResidents}</h3>
            {/if}
          </div>
          <div class="rounded-2xl bg-brand/5 p-3 text-brand">
            <Users class="h-6 w-6" />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg">
      <Card.Content class="px-4 py-0 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Pending Receipts
            </p>
            {#if isLoading}
              <div class="h-9 w-12 animate-pulse rounded bg-muted/50"></div>
            {:else}
              <h3 class="text-3xl font-black text-foreground">{stats.pendingSettlements}</h3>
            {/if}
          </div>
          <div class="rounded-2xl bg-brand/5 p-3 text-brand">
            <Clock class="h-6 w-6" />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg">
      <Card.Content class="px-4 py-0 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Total Collected
            </p>
            {#if isLoading}
              <div class="h-8 w-32 animate-pulse rounded bg-muted/50"></div>
            {:else}
              <h3 class="text-2xl font-black text-foreground">
                {formatCurrency(stats.totalCollected)}
              </h3>
            {/if}
          </div>
          <div class="rounded-2xl bg-brand/5 p-3 text-brand">
            <TrendingUp class="h-6 w-6" />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root class="overflow-hidden border-none bg-card shadow-md transition-all hover:shadow-lg">
      <Card.Content class="px-4 py-0 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Collection Rate
            </p>
            {#if isLoading}
              <div class="h-9 w-20 animate-pulse rounded bg-muted/50"></div>
            {:else}
              <h3 class="text-3xl font-black text-foreground">
                {stats.collectionRate.toFixed(1)}%
              </h3>
            {/if}
          </div>
          <div class="rounded-2xl bg-brand/5 p-3 text-brand">
            <CircleCheck class="h-6 w-6" />
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <div class="grid gap-8 lg:grid-cols-3">
    <!-- Tools Section -->
    <div class="lg:col-span-2">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-bold text-foreground">Administrative Tools</h2>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        {#each tools as tool}
          <a
            href={tool.href}
            class="group relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-5 transition-all duration-300 hover:shadow-xl {tool.border}"
          >
            <div class={`w-fit rounded-xl ${tool.bg} p-2.5 ${tool.color}`}>
              <tool.icon class="h-6 w-6" />
            </div>
            <div>
              <h3 class="font-bold text-foreground">{tool.title}</h3>
              <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {tool.description}
              </p>
            </div>
            <div
              class="absolute right-5 bottom-5 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            >
              <ArrowRight class={`h-5 w-5 ${tool.color}`} />
            </div>
          </a>
        {/each}
      </div>
    </div>

    <!-- Recent Activity -->
    <div>
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-bold text-foreground">Recent Transactions</h2>
        <Button variant="ghost" size="icon" href="/admin/transactions" title="View All">
          <ArrowRight class="h-4 w-4" />
        </Button>
      </div>
      <Card.Root class="overflow-hidden border-none bg-card p-0 shadow-md">
        <Card.Content class="divide-y p-0">
          {#if isLoading}
            {#each Array(5) as _}
              <div class="flex animate-pulse items-center gap-4 p-4">
                <div class="h-10 w-10 rounded-full bg-muted"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-3 w-1/2 rounded bg-muted/50"></div>
                  <div class="h-2 w-1/3 rounded bg-muted/50"></div>
                </div>
              </div>
            {/each}
          {:else if recentTransactions.length > 0}
            {#each recentTransactions as tx}
              <div
                class="group flex items-start gap-3 p-3 transition-colors hover:bg-muted/50 sm:items-center sm:gap-4 sm:p-4"
              >
                <div
                  class="shrink-0 rounded-full p-2.5 transition-colors group-hover:bg-card group-hover:shadow-sm {tx.amount >
                  0
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : tx.amount < 0
                      ? 'bg-rose-500/10 text-rose-600'
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

                <div
                  class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-foreground">{tx.name}</p>
                    <p class="truncate text-[10px] font-bold text-muted-foreground uppercase">
                      {translateType(tx.type, transactionTypes)} • {formatDate(tx.date)}
                    </p>
                  </div>
                  <div class="shrink-0 text-left sm:text-right">
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
</div>
