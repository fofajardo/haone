<script lang="ts">
  import { onMount } from "svelte";
  import { emailDispatcher } from "$lib/dispatcher.svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { formatCurrency, translatePeriod, formatAccounting } from "$lib/receipt-utils";
  import { ACCOUNT_COL as COL, type ResidentRecord as Resident } from "$lib/schemas";
  import { parseAmount, mapRowToResident, stageStatusEmailBatch } from "$lib/resident-logic";
  import { auth } from "$lib/auth.svelte";
  import { goto } from "$app/navigation";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    Users,
    Search,
    Mail,
    CircleCheckBig,
    CircleAlert,
    ArrowUpDown,
    FunnelX
  } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  let residents = $state<Resident[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let filterSearch = $state("");
  let filterRoom = $state("ALL");
  let filterStatus = $state("ALL");
  let selectedIndices = $state<Set<string>>(new Set()); // Uses stno as key

  // Sort
  let sortKey = $state("NAME");
  let sortOrder = $state<"asc" | "desc">("asc");

  // Custom Reminders (Rich Text / HTML support)
  let customReminders = $state("");

  async function loadData(forceRefresh = false) {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    try {
      const rows = await fetchSheetRowsRaw(
        brandingState.spreadsheetId,
        "accounts!A:AD",
        forceRefresh
      );
      residents = rows
        .slice(1)
        .map((row) => mapRowToResident(row))
        .filter(
          (r) =>
            r.email &&
            r.email !== "_vacant" &&
            (!uiSettings.currentSemester || r.period === uiSettings.currentSemester)
        );
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);

  const filteredResidents = $derived.by(() => {
    return residents
      .filter((r) => {
        const matchSearch =
          !filterSearch ||
          r.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
          r.email.toLowerCase().includes(filterSearch.toLowerCase()) ||
          r.room.toLowerCase().includes(filterSearch.toLowerCase());

        const matchRoom = filterRoom === "ALL" || r.room === filterRoom;
        const matchStatus =
          filterStatus === "ALL" ||
          (filterStatus === "FULLY_PAID" && r.isFullyPaid) ||
          (filterStatus === "PENDING" && !r.isFullyPaid);

        return matchSearch && matchRoom && matchStatus;
      })
      .sort((a, b) => {
        const order = sortOrder === "asc" ? 1 : -1;
        if (sortKey === "NAME") return a.name.localeCompare(b.name) * order;
        if (sortKey === "ROOM") return a.room.localeCompare(b.room) * order;
        if (sortKey === "BED") return a.bed.localeCompare(b.bed) * order;
        if (sortKey === "BAL") return (a.bal - b.bal) * order;
        if (sortKey === "STATUS") return (Number(a.isFullyPaid) - Number(b.isFullyPaid)) * order;
        return 0;
      });
  });

  const rooms = $derived([
    "ALL",
    ...new Set(
      residents
        .map((r) => r.room)
        .filter(Boolean)
        .sort()
    )
  ]);

  function toggleSort(key: string) {
    if (sortKey === key) sortOrder = sortOrder === "asc" ? "desc" : "asc";
    else {
      sortKey = key;
      sortOrder = "asc";
    }
  }

  function resetFilters() {
    filterSearch = "";
    filterRoom = "ALL";
    filterStatus = "ALL";
  }

  function toggleSelectAll() {
    if (selectedIndices.size === filteredResidents.length) selectedIndices = new Set();
    else selectedIndices = new Set(filteredResidents.map((r) => r.stno));
  }

  function toggleResident(stno: string) {
    if (selectedIndices.has(stno)) selectedIndices.delete(stno);
    else selectedIndices.add(stno);
    selectedIndices = new Set(selectedIndices);
  }

  function prepareDispatch() {
    if (selectedIndices.size === 0) return;
    const selectedResidents = residents.filter((r) => selectedIndices.has(r.stno));
    stageStatusEmailBatch(selectedResidents, brandingState.profile, {
      clearQueue: true,
      customReminders,
      redirect: true
    });
  }
</script>

<div class="space-y-3">
  <SubpageHeader title="Residents">
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData(true)} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
          <span class="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" disabled={selectedIndices.size === 0} onclick={prepareDispatch}>
          <Mail class="mr-2 h-4 w-4" />
          Send Reminder ({selectedIndices.size})
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  <div class="grid gap-2 lg:grid-cols-12">
    <div class="lg:col-span-2">
      <TermFilter onSelect={() => loadData()} />
    </div>
    <div class="space-y-1 lg:col-span-5">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
      <div class="relative">
        <Search class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          bind:value={filterSearch}
          placeholder="Search by name, email, or room..."
          class="h-9 pl-9 text-xs"
        />
      </div>
    </div>

    <div class="space-y-1 lg:col-span-2">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Room</Label>
      <NativeSelect.Root bind:value={filterRoom} class="h-9 text-xs font-semibold">
        {#each rooms as room}
          <NativeSelect.Option value={room}
            >{room === "ALL" ? "All Rooms" : room}</NativeSelect.Option
          >
        {/each}
      </NativeSelect.Root>
    </div>

    <div class="space-y-1 lg:col-span-2">
      <Label class="text-[10px] font-bold text-muted-foreground uppercase">Payment Status</Label>
      <NativeSelect.Root bind:value={filterStatus} class="h-9 text-xs font-semibold">
        <NativeSelect.Option value="ALL">All Statuses</NativeSelect.Option>
        <NativeSelect.Option value="FULLY_PAID">Fully Paid</NativeSelect.Option>
        <NativeSelect.Option value="PENDING">Pending</NativeSelect.Option>
      </NativeSelect.Root>
    </div>

    <div class="flex items-end lg:col-span-1">
      <Button variant="outline" size="sm" onclick={resetFilters} class="h-9 w-full px-2 text-xs">
        <FunnelX class="mr-2 h-4 w-4" /> Clear
      </Button>
    </div>
  </div>

  {#if isLoading}
    <LoadingView text="Loading resident directory..." />
  {:else if error}
    <div
      class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm font-medium text-destructive"
    >
      {error}
    </div>
  {:else if filteredResidents.length > 0}
    <Card.Root class="overflow-hidden p-0">
      <Card.Content class="p-0">
        <Table.Root>
          <Table.Header>
            <Table.Row class="bg-muted/5">
              <Table.Head class="w-10 px-4">
                <Checkbox
                  checked={selectedIndices.size === filteredResidents.length}
                  onCheckedChange={toggleSelectAll}
                />
              </Table.Head>
              <Table.Head class="px-4 py-3"
                ><button
                  onclick={() => toggleSort("NAME")}
                  class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                  >Resident {#if sortKey === "NAME"}{sortOrder === "asc"
                      ? "↑"
                      : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                ></Table.Head
              >
              <Table.Head class="px-4 py-3"
                ><button
                  onclick={() => toggleSort("ROOM")}
                  class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                  >Room {#if sortKey === "ROOM"}{sortOrder === "asc" ? "↑" : "↓"}{:else}<ArrowUpDown
                      class="h-3 w-3 opacity-30"
                    />{/if}</button
                ></Table.Head
              >
              <Table.Head class="px-4 py-3"
                ><button
                  onclick={() => toggleSort("BED")}
                  class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                  >Bed {#if sortKey === "BED"}{sortOrder === "asc" ? "↑" : "↓"}{:else}<ArrowUpDown
                      class="h-3 w-3 opacity-30"
                    />{/if}</button
                ></Table.Head
              >
              <Table.Head
                class="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase"
                >Water Bal</Table.Head
              >
              <Table.Head
                class="px-4 py-3 text-right text-[10px] font-bold whitespace-nowrap text-muted-foreground uppercase tabular-nums"
                >Assoc Bal</Table.Head
              >
              <Table.Head class="px-4 py-3 text-right"
                ><button
                  onclick={() => toggleSort("BAL")}
                  class="ml-auto flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap text-muted-foreground uppercase"
                  >Outstanding {#if sortKey === "BAL"}{sortOrder === "asc"
                      ? "↑"
                      : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                ></Table.Head
              >
              <Table.Head class="px-4 py-3 text-center"
                ><button
                  onclick={() => toggleSort("STATUS")}
                  class="mx-auto flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap text-muted-foreground uppercase"
                  >Status {#if sortKey === "STATUS"}{sortOrder === "asc"
                      ? "↑"
                      : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                ></Table.Head
              >
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each filteredResidents as r}
              <Table.Row
                class="cursor-pointer transition-colors hover:bg-muted/5 {selectedIndices.has(
                  r.stno
                )
                  ? 'bg-muted/5'
                  : ''}"
                onclick={() => toggleResident(r.stno)}
              >
                <Table.Cell class="px-4 py-3 align-top"
                  ><Checkbox
                    checked={selectedIndices.has(r.stno)}
                    onCheckedChange={() => toggleResident(r.stno)}
                    onclick={(e) => e.stopPropagation()}
                  /></Table.Cell
                >
                <Table.Cell class="px-4 py-3 align-top">
                  <div class="flex flex-col">
                    <a
                      href="/legacy/admin/residents/{r.stno}"
                      class="text-xs font-bold text-slate-900 transition-colors hover:text-primary hover:underline"
                      onclick={(e) => e.stopPropagation()}>{r.name}</a
                    >
                    <span class="text-[10px] text-muted-foreground">{r.email}</span>
                  </div>
                </Table.Cell>
                <Table.Cell class="px-4 py-3 align-top"
                  ><span class="text-xs font-medium text-slate-600">{r.room || "—"}</span
                  ></Table.Cell
                >
                <Table.Cell class="px-4 py-3 align-top"
                  ><span class="text-xs font-medium text-slate-600">{r.bed || "—"}</span
                  ></Table.Cell
                >
                <Table.Cell class="px-4 py-3 text-right align-top font-mono text-xs tabular-nums"
                  >{formatAccounting(r.waterBal)}</Table.Cell
                >
                <Table.Cell class="px-4 py-3 text-right align-top font-mono text-xs tabular-nums"
                  >{formatAccounting(r.assocBal)}</Table.Cell
                >
                <Table.Cell
                  class="px-4 py-3 text-right align-top font-mono text-xs font-bold tabular-nums {r.bal >
                  0
                    ? 'text-slate-900'
                    : 'text-primary'}"
                >
                  <div class="flex flex-col items-end">
                    <span>{formatAccounting(r.bal)}</span>
                    {#if r.bal < 0}
                      <span class="text-[8px] font-black tracking-tighter text-primary uppercase"
                        >Overpaid</span
                      >
                    {/if}
                  </div>
                </Table.Cell>
                <Table.Cell class="px-4 py-3 text-center align-top">
                  <div class="flex flex-col items-center gap-1">
                    {#if r.isFullyPaid}
                      <span
                        class="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-800"
                        >FULLY PAID</span
                      >
                    {:else}
                      <span
                        class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-400"
                        >PENDING</span
                      >
                    {/if}

                    {#if r.bal === 0 && (r.waterBal < 0 || r.assocBal < 0)}
                      <span
                        class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[8px] font-black text-amber-700 uppercase"
                        title="Outstanding is 0 but water/assoc balances are negative. Check for misassigned payments."
                      >
                        <CircleAlert class="h-2.5 w-2.5" />
                        Potential Misassignment
                      </span>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  {:else}
    <div
      class="flex h-80 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/10"
    >
      <Users class="h-8 w-8 text-muted-foreground" />
      <div class="text-center">
        <p class="font-semibold text-slate-900">No residents found.</p>
        <p class="text-xs text-muted-foreground">Adjust filters or search query.</p>
      </div>
    </div>
  {/if}
</div>
