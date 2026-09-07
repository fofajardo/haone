<script lang="ts">
  import {
    Users,
    Receipt,
    ChartPie,
    Settings,
    TrendingUp,
    Clock,
    CircleCheck,
    Bed,
    HandCoins,
    RotateCcwClock,
    Contact,
    GraduationCap,
    BookUser,
    ArrowRightLeft,
    Banknote,
    WashingMachine,
    Refrigerator,
    Megaphone,
    Trophy,
    ListOrdered
  } from "@lucide/svelte";
  import { auth } from "$state/auth.svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchJournalEntries } from "$api/controllers/journal-controller";
  import { fetchTransactionTypes } from "$api/controllers/constants-controller";
  import { fetchResidents } from "$api/controllers/resident-controller";
  import { formatCurrency } from "$utils/formatters";
  import { translatePeriod } from "$utils/translators";
  import DashboardActionCard from "$components/DashboardActionCard.svelte";
  import StatisticCard from "$components/StatisticCard.svelte";
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import * as Card from "$ui/card";
  import { getCustomServices } from "$lib/services";

  let stats = $state({
    activeResidents: 0,
    pendingSettlements: 0,
    totalCollected: 0,
    collectionRate: 0
  });

  let recentTransactions = $state<any[]>([]);
  let transactionTypes = $state<{ value: string; label: string }[]>([]);
  let isLoading = $state(true);

  const actions = $derived([
    {
      title: "Financial Report",
      description: "Generate collection summaries and financial statements.",
      href: "/admin/financial-report",
      icon: HandCoins
    },
    {
      title: "Transactions",
      description: "Full transaction history and manual entry management.",
      href: "/admin/transactions",
      icon: RotateCcwClock
    },
    {
      title: "Pending Receipts",
      description: "Review pending payments and generate secure receipts.",
      href: "/admin/transactions/pending",
      icon: Receipt
    },
    {
      title: "Payment Requests",
      description: "Review and approve resident payment submissions.",
      href: "/admin/transactions/requests",
      icon: Banknote
    },
    {
      title: "Residents",
      description: "Manage resident profiles, rooms, and balances.",
      href: "/admin/residents",
      icon: Users
    },
    {
      title: "Rooms",
      description: "Manage room inventory, bed assignments, and occupancy.",
      href: "/admin/residents/rooms",
      icon: Bed
    },
    {
      title: "Officers",
      description: "Manage house council directory and officer positions.",
      href: "/admin/residents/officers",
      icon: BookUser
    },
    {
      title: "Resident Sync",
      description: "Preview and sync resident accounts from registration queue.",
      href: "/admin/residents/sync",
      icon: ArrowRightLeft
    },
    {
      title: "Users",
      description: "Master directory of all residents across all terms.",
      href: "/admin/users",
      icon: Contact
    },
    {
      title: "Demographics",
      description: "Analyze resident distribution and historical trends.",
      href: "/admin/demographics",
      icon: ChartPie
    },
    {
      title: "Academic Terms",
      description: "Configure academic terms, fee schedules, and active periods.",
      href: "/admin/academic-terms",
      icon: GraduationCap
    },
    {
      title: "Laundry",
      description: "Monitor and manage laundry schedule reservations.",
      href: "/admin/laundry",
      icon: WashingMachine
    },
    {
      title: "Fridge",
      description: "Monitor and manage shared refrigerator storage items.",
      href: "/admin/fridge",
      icon: Refrigerator
    },
    {
      title: "Announcements",
      description: "Draft, publish, and manage house announcements.",
      href: "/admin/announcements",
      icon: Megaphone
    },
    {
      title: "Achievements",
      description: "Create and award achievements and badges to residents.",
      href: "/admin/achievements",
      icon: Trophy
    },
    {
      title: "Leaderboards",
      description: "View achievement leaderboards and resident rankings.",
      href: "/admin/leaderboards",
      icon: ListOrdered
    },
    ...getCustomServices("admin").map((s) => ({
      title: s.title,
      description: s.description || "",
      href: s.url,
      icon: s.icon
    })),
    {
      title: "Settings",
      description: "Personalize interface, manage accessibility, and system preferences.",
      href: "/admin/settings",
      icon: Settings
    }
  ]);

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

      // Total Collected in Term
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

  onMount(() => {
    pageState.title = "Dashboard";
    pageState.isTopLevel = true;
    loadDashboardData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <!-- Header Section -->
  <div class="mb-5">
    <h1 class="mb-2 text-4xl font-bold tracking-tight">
      Welcome back, {auth.user?.name.split(" ")[0]}
    </h1>
    <div>
      Manage residents, track collections, and automate communications for <span
        class="font-semibold">{translatePeriod(uiSettings.currentTerm) || "Active Term"}</span
      >.
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

  <!-- Tools -->
  <Card.Root class="mt-6 shadow-none">
    <Card.Header>
      <Card.Title>Tools</Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each actions as tool}
          <DashboardActionCard {...tool} />
        {/each}
      </div>
    </Card.Content>
  </Card.Root>
</div>
