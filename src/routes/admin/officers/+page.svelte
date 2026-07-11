<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, Search } from "@lucide/svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import { fetchOfficers } from "$lib/admin-logic";
  import { fetchTermCurr } from "$lib/resident-logic";
  import type { OfficerRecord } from "$lib/schemas";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { createColumns } from "./columns";
  import { TableSync } from "$lib/components/ui/data-table/table-sync.svelte";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import { goto } from "$app/navigation";
  import { pageState } from "$lib/page-info.svelte";

  let officers = $state<OfficerRecord[]>([]);
  let currentTerm = $state("");
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const tableSync = new TableSync({
    initialFilters: { search: "", term: "ALL" },
    paramMap: { search: "q", term: "term" },
    searchKey: "search"
  });

  async function loadData(forceRefresh = false) {
    isLoading = true;
    error = null;
    try {
      [officers, currentTerm] = await Promise.all([
        fetchOfficers(forceRefresh),
        fetchTermCurr(forceRefresh)
      ]);
      if (tableSync.filters!.term === "ALL") {
        tableSync.filters!.term = currentTerm;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Officers";
    loadData();
  });

  const columns = createColumns(loadData);

  const filteredOfficers = $derived.by(() => {
    return officers.filter((o) => {
      const search = tableSync.filters!.search.toLowerCase();
      const term = tableSync.filters!.term;

      const matchesSearch =
        o.name.toLowerCase().includes(search) ||
        o.email.toLowerCase().includes(search) ||
        o.position.toLowerCase().includes(search);
      const matchesTerm = term === "ALL" || o.term === term;

      return matchesSearch && matchesTerm;
    });
  });
</script>

<div class="space-y-6">
  <SubpageHeader title="Officers" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData(true)}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button size="sm" onclick={() => goto("/admin/officers/new")} icon={Plus}>Add</Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} {isLoading} icon={RefreshCcw} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="lg:col-span-4">
        <TermFilter bind:value={tableSync.filters!.term} onSelect={() => loadData()} />
      </div>

      <div class="space-y-1 lg:col-span-8">
        <Label>Search</Label>
        <div class="relative">
          <Search
            class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={tableSync.filters!.search}
            placeholder="Search officers…"
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>
    </div>

    <DataTable
      {columns}
      data={filteredOfficers}
      rowId="id"
      onRowClick={(o) => goto(`/admin/officers/${o.id}`)}
    />
  {/if}
</div>
