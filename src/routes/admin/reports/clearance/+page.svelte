<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import {
    Search,
    RefreshCcw,
    Share,
    Clock,
    Ban,
    UserCheck,
    CircleAlert,
    CircleCheck
  } from "lucide-svelte";
  import { Label } from "$lib/components/ui/label";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { mapRowToResident } from "$lib/resident-logic";
  import type { ResidentRecord } from "$lib/schemas";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";

  // Removed wrong import

  let residents = $state<ResidentRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let allAccounts = $state<ResidentRecord[]>([]);
  let activeTab = $state("fully_paid");
  let pagination = $state({ pageIndex: 0, pageSize: 20 });

  const categories = [
    { id: "fully_paid", label: "Fully Paid", icon: CircleCheck },
    { id: "half_fully_paid", label: "Half-Fully Paid", icon: Clock },
    { id: "partially_paid", label: "Partially Paid", icon: CircleAlert },
    { id: "no_payment", label: "No Payment", icon: Ban },
    { id: "cleared", label: "Cleared", icon: UserCheck }
  ];

  const filteredResidents = $derived(
    residents.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.stno.includes(searchQuery);

      if (!matchesSearch) return false;

      const progress = r.totalBase > 0 ? r.paid / r.totalBase : 0;

      switch (activeTab) {
        case "fully_paid":
          return r.isFullyPaid || (r.bal <= 0 && r.totalBase > 0);
        case "half_fully_paid":
          return !r.isFullyPaid && progress >= 0.5 && r.paid > 0;
        case "partially_paid":
          return !r.isFullyPaid && progress < 0.5 && r.paid > 0;
        case "no_payment":
          return r.paid <= 0;
        case "cleared":
          return !!r.ceIssued && r.ceIssued !== "" && r.ceIssued !== "#N/A" && r.ceIssued !== "N/A";
        default:
          return true;
      }
    })
  );

  async function loadData(force = false) {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;

    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:Z", force);
      const currentSem = uiSettings.currentSemester.trim();

      const mapped = rows
        .slice(1)
        .map(mapRowToResident)
        .filter((r) => r.email && r.email !== "_vacant");

      allAccounts = mapped;
      residents = mapped.filter((r) => r.period === currentSem);
    } catch (e: any) {
      error = e.message || "Failed to load resident data";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  function goToExport() {
    goto(`/admin/reports/export-resident-list?category=${activeTab}`);
  }
</script>

<div class="space-y-4 pb-10">
  <SubpageHeader title="Clearance" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
          <span class="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" onclick={goToExport} disabled={isLoading || residents.length === 0}>
          <Share class="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading && residents.length === 0}
    <LoadingView text="Generating reports…" />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}>Try Again</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-2 lg:grid-cols-12">
      <!-- Row 1: Term and Search -->
      <div class="lg:col-span-3">
        <TermFilter onSelect={() => loadData()} />
      </div>
      <div class="space-y-1 lg:col-span-9">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
        <div class="relative">
          <Search
            class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search by name, student number…"
            bind:value={searchQuery}
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>
    </div>

    <Tabs.Root bind:value={activeTab}>
      <div class="scrollbar-hide overflow-x-auto pb-2">
        <Tabs.List
          class="inline-flex h-9 w-max items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground sm:w-full sm:justify-center"
        >
          {#each categories as cat}
            <Tabs.Trigger value={cat.id} class="flex items-center gap-2 px-3 whitespace-nowrap">
              <cat.icon />
              <span>{cat.label}</span>
            </Tabs.Trigger>
          {/each}
        </Tabs.List>
      </div>

      {#each categories as cat}
        <Tabs.Content value={cat.id}>
          {#if filteredResidents.length > 0}
            <DataTable
              data={filteredResidents}
              {columns}
              {pagination}
              onPaginationChange={(p) => (pagination = p)}
              onRowClick={(r) => goto(`/admin/residents/${r.stno}`)}
              rowId="stno"
            />
          {:else}
            <div
              class="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-muted-foreground"
            >
              <CircleAlert class="mb-2 h-8 w-8 opacity-20" />
              <p>No residents found in this category.</p>
            </div>
          {/if}
        </Tabs.Content>
      {/each}
    </Tabs.Root>
  {/if}
</div>
