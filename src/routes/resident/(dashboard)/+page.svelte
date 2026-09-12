<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import {
    RefreshCcw,
    Wallet,
    ShieldCheck,
    MapPin,
    WashingMachine,
    Banknote,
    Trophy,
    House,
    Settings,
    Megaphone,
    BookUser,
    Refrigerator,
    ListOrdered
  } from "@lucide/svelte";
  import AnnouncementsSection from "$components/dashboard/AnnouncementsSection.svelte";
  import RecentActivityCard from "$components/dashboard/RecentActivityCard.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { formatCurrency } from "$utils/formatters";
  import { translatePeriod } from "$utils/translators";
  import { pageState } from "$state/page-info.svelte";
  import StatusBadge from "$components/residents/StatusBadge.svelte";
  import DashboardActionCard from "$components/dashboard/DashboardActionCard.svelte";
  import type { ResidentStatus } from "$state/resident-state.svelte";
  import { AccountType } from "$lib/types";
  import { StatisticCard } from "$components/ui/haone";
  import {
    fetchResidentStatus,
    isResidentRouteAllowed
  } from "$api/controllers/resident-controller";
  import { getCustomServices } from "$lib/services";
  import { namecase } from "@compwright/namecase";
  import { uiSettings } from "$state/settings.svelte";

  let status = $state<ResidentStatus | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      status = await fetchResidentStatus(uiSettings.currentTerm, bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  const allActions = [
    {
      title: "Finance",
      description: "View your financial standing and history.",
      href: "/resident/finance",
      icon: Wallet
    },
    {
      title: "Occupancy",
      description: "View your current room details and history.",
      href: "/resident/occupancy",
      icon: House
    },
    {
      title: "Laundry",
      description: "Book and manage your laundry reservations.",
      href: "/resident/laundry",
      icon: WashingMachine
    },
    {
      title: "Fridge",
      description: "Browse inventory and store items in the shared fridge.",
      href: "/resident/fridge",
      icon: Refrigerator
    },
    {
      title: "Payment Requests",
      description: "Upload your transaction entries for verification.",
      href: "/resident/payment-requests",
      icon: Banknote
    },
    ...getCustomServices("resident").map((s) => ({
      title: s.title,
      description: s.description || "",
      href: s.url,
      icon: s.icon
    })),
    {
      title: "Announcements",
      description: "View updates and announcements from house council officers.",
      href: "/resident/announcements",
      icon: Megaphone
    },
    {
      title: "Achievements",
      description: "View your earned achievements and badges.",
      href: "/resident/achievements",
      icon: Trophy
    },
    {
      title: "Leaderboards",
      description: "View achievement leaderboards and resident rankings.",
      href: "/resident/leaderboards",
      icon: ListOrdered
    },
    {
      title: "Officers",
      description: "View profiles and contacts of house council officers.",
      href: "/resident/officers",
      icon: BookUser
    },
    {
      title: "Settings",
      description: "Customize your profile and application preferences.",
      href: "/resident/settings",
      icon: Settings
    }
  ];

  const actions = $derived.by(() => {
    const type = status?.account?.type || "";
    const room = status?.account?.room || "";
    return allActions.filter((tool) => isResidentRouteAllowed(tool.href, type, room));
  });

  onMount(() => {
    pageState.title = "Dashboard";
    pageState.isTopLevel = true;
  });

  $effect(() => {
    uiSettings.currentTerm;
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <!-- Header Section -->
  <div class="mb-5 flex items-start justify-between">
    <div>
      <h1 class="mb-2 text-4xl font-bold tracking-tight">
        Welcome back, {namecase(auth.preferredName)}
      </h1>
      <div>
        View your profile, track your financial standing, and manage your clearance for <span
          class="font-semibold">{translatePeriod(uiSettings.currentTerm) || "Active Term"}</span
        >.
      </div>
    </div>
    <Button
      variant="ghost"
      size="icon"
      class="h-10 w-10 text-muted-foreground hover:text-foreground"
      onclick={() => loadData(true)}
      {isLoading}
      icon={RefreshCcw}
      title="Refresh"
    />
  </div>

  {#if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
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
          title="Room"
          value={status.account.bed
            ? `${status.account.room}-${status.account.bed}`
            : `${status.account.room}`}
          {isLoading}
        >
          {#snippet icon()}<MapPin class="h-6 w-6" />{/snippet}
        </StatisticCard>
      {/if}
    </div>
  {/if}

  <div class="mt-6 grid min-w-0 gap-8 lg:grid-cols-3">
    <!-- Announcements Section (2 cols) -->
    <div class="min-w-0 lg:col-span-2">
      <AnnouncementsSection />
    </div>

    <!-- Recent Transactions (1 col) -->
    <div class="min-w-0">
      <RecentActivityCard transactions={status?.transactions} period={status?.activeTerm} />
    </div>
  </div>

  <!-- Tools Section (3 cols) -->
  <div class="my-6 space-y-6">
    <div class="text-xl font-semibold">Tools</div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each actions as tool}
        <DashboardActionCard {...tool} />
      {/each}
    </div>
  </div>
</div>
