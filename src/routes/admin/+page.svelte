<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
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
    FileSpreadsheet,
    Bed
  } from "@lucide/svelte";
  import { auth } from "$state/auth.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchJournalEntries, mapRowToJournal } from "$api/controllers/journal-controller";
  import { fetchTransactionTypes } from "$api/controllers/constants-controller";
  import { fetchResidents } from "$api/controllers/resident-controller";
  import { formatCurrency, formatDate } from "$utils/formatters";
  import { translatePeriod, translateType } from "$utils/translators";
  import DashboardActionCard from "$components/DashboardActionCard.svelte";
  import StatisticCard from "$components/StatisticCard.svelte";
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

  const actions: any[] = [
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
      title: "Users",
      description: "Master directory of all residents across all terms.",
      href: "/admin/users",
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
      title: "Rooms",
      description: "Manage room inventory, bed assignments, and occupancy.",
      href: "/admin/rooms",
      icon: Bed,
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
    isLoading = true;

    try {
      const [journalEntries, allResidents, types, currentTerm] = await Promise.all([
        fetchJournalEntries(),
        fetchResidents(),
        fetchTransactionTypes(),
        uiSettings.ensureCurrentTerm()
      ]);

      transactionTypes = types;
      const journals = Array.isArray(journalEntries) ? journalEntries : journalEntries.items;

      // Stats from Accounts
      const accounts = allResidents.filter((r) => {
        return (
          r.period === currentTerm &&
          r.email &&
          r.email !== "_vacant" &&
          !(r.bed || "").includes("(")
        );
      });

      stats.activeResidents = accounts.length;

      const fullyPaidCount = accounts.filter((r) => r.isFullyPaid).length;
      stats.collectionRate =
        stats.activeResidents > 0 ? (fullyPaidCount / stats.activeResidents) * 100 : 0;

      // Stats from Journal
      const journalData = journals;
      const pending = journalData.filter((r) => {
        return (
          r.period === currentTerm &&
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
        .filter((r) => r.period === currentTerm)
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

<div class="space-y-6 pb-12">
  <!-- Header Section -->
  <div
    class="relative overflow-hidden rounded-3xl bg-brand/10 px-4 py-8 text-brand sm:px-8 sm:py-12"
  >
    <div class="relative z-10 space-y-4">
      <div class="flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase"></div>
      <h1 class="text-4xl font-black tracking-tight md:text-5xl lg:text-6xl">
        Welcome back, {auth.user?.name.split(" ")[0]}
      </h1>
      <p class="text-lg text-brand md:text-xl">
        Manage residents, track collections, and automate communications for <span
          class="font-semibold">{translatePeriod(uiSettings.currentTerm) || "Active Term"}</span
        >.
      </p>
    </div>
  </div>

  <!-- Quick Stats -->
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <StatisticCard title="Active Residents" value={stats.activeResidents} {isLoading}>
      {#snippet icon()}<Users class="h-6 w-6" />{/snippet}
    </StatisticCard>

    <StatisticCard title="Pending Receipts" value={stats.pendingSettlements} {isLoading}>
      {#snippet icon()}<Clock class="h-6 w-6" />{/snippet}
    </StatisticCard>

    <StatisticCard title="Total Collected" value={formatCurrency(stats.totalCollected)} {isLoading}>
      {#snippet icon()}<TrendingUp class="h-6 w-6" />{/snippet}
    </StatisticCard>

    <StatisticCard
      title="Collection Rate"
      value={`${stats.collectionRate.toFixed(1)}%`}
      {isLoading}
    >
      {#snippet icon()}<CircleCheck class="h-6 w-6" />{/snippet}
    </StatisticCard>
  </div>

  <!-- Administrative Tools -->
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-foreground">Administrative Tools</h2>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each actions as tool}
        <DashboardActionCard {...tool} />
      {/each}
    </div>
  </div>
</div>
