<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { formatAccounting } from "$lib/receipt-utils";
  import { type ResidentRecord as Resident } from "$lib/schemas";
  import { mapRowToResident, stageStatusEmailBatch } from "$lib/resident-logic";
  import { goto } from "$app/navigation";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    Users,
    Search,
    Mail,
    Clock,
    CircleAlert,
    TriangleAlert,
    ArrowUpDown,
    FunnelX
  } from "lucide-svelte";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import Check from "@lucide/svelte/icons/check";

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

<Tooltip.Provider>
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

    {#if isLoading}
      <LoadingView text="Loading resident directory..." />
    {:else if error}
      <ErrorView {error}>
        <Button variant="outline" size="sm" class="mt-2" onclick={() => loadData()}
          >Try Again</Button
        >
      </ErrorView>
    {:else}
      <div class="grid gap-2 lg:grid-cols-12">
        <div class="lg:col-span-2">
          <TermFilter onSelect={() => loadData()} />
        </div>
        <div class="space-y-1 lg:col-span-5">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
          <div class="relative">
            <Search
              class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              bind:value={filterSearch}
              placeholder="Search by name, email, or room..."
              class="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Room</Label>
          <NativeSelect.Root bind:value={filterRoom} class="h-10 w-full text-xs font-semibold">
            {#each rooms as room}
              <NativeSelect.Option value={room}
                >{room === "ALL" ? "All Rooms" : room}</NativeSelect.Option
              >
            {/each}
          </NativeSelect.Root>
        </div>

        <div class="space-y-1 lg:col-span-2">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Payment Status</Label
          >
          <NativeSelect.Root bind:value={filterStatus} class="h-10 w-full text-xs font-semibold">
            <NativeSelect.Option value="ALL">All Statuses</NativeSelect.Option>
            <NativeSelect.Option value="FULLY_PAID">Fully Paid</NativeSelect.Option>
            <NativeSelect.Option value="PENDING">Pending</NativeSelect.Option>
          </NativeSelect.Root>
        </div>

        <div class="flex items-end lg:col-span-1">
          <Button
            variant="outline"
            size="sm"
            onclick={resetFilters}
            class="h-9 w-full px-2 text-xs"
          >
            <FunnelX class="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      {#if filteredResidents.length > 0}
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
                      >Room {#if sortKey === "ROOM"}{sortOrder === "asc"
                          ? "↑"
                          : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                    ></Table.Head
                  >
                  <Table.Head class="px-4 py-3"
                    ><button
                      onclick={() => toggleSort("BED")}
                      class="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                      >Bed {#if sortKey === "BED"}{sortOrder === "asc"
                          ? "↑"
                          : "↓"}{:else}<ArrowUpDown class="h-3 w-3 opacity-30" />{/if}</button
                    ></Table.Head
                  >
                  <Table.Head
                    class="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase"
                    >Water Fee</Table.Head
                  >
                  <Table.Head
                    class="px-4 py-3 text-right text-[10px] font-bold whitespace-nowrap text-muted-foreground uppercase tabular-nums"
                    >Association Fee</Table.Head
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
                    onclick={() => goto(`/admin/residents/${r.stno}`)}
                  >
                    <Table.Cell class="px-4 py-3 align-top"
                      ><Checkbox
                        checked={selectedIndices.has(r.stno)}
                        onCheckedChange={() => toggleResident(r.stno)}
                        onclick={(e) => e.stopPropagation()}
                      /></Table.Cell
                    >
                    <Table.Cell class="px-4 py-3 align-top">
                      <span class="font-semibold">{r.name}</span>
                    </Table.Cell>
                    <Table.Cell class="px-4 py-3 align-top"
                      ><span class="font-medium text-muted-foreground">{r.room || "—"}</span
                      ></Table.Cell
                    >
                    <Table.Cell class="px-4 py-3 align-top"
                      ><span class="font-medium text-muted-foreground">{r.bed || "—"}</span
                      ></Table.Cell
                    >
                    <Table.Cell class="px-4 py-3 text-right align-top font-mono tabular-nums"
                      >{formatAccounting(r.waterBal)}</Table.Cell
                    >
                    <Table.Cell class="px-4 py-3 text-right align-top font-mono tabular-nums"
                      >{formatAccounting(r.assocBal)}</Table.Cell
                    >
                    <Table.Cell
                      class="px-4 py-3 text-right align-top font-mono font-bold tabular-nums {r.bal >
                      0
                        ? 'text-foreground'
                        : 'text-primary'}"
                    >
                      <div class="flex flex-col items-end">
                        <span>{formatAccounting(r.bal)}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell class="px-4 py-3 text-center align-top">
                      <div class="flex items-center justify-center gap-1.5">
                        {#if r.isFullyPaid}
                          <Tooltip.Root>
                            <Tooltip.Trigger>
                              <Badge
                                variant="outline"
                                class="border-emerald-500/20 bg-emerald-500/10 p-1.5 text-emerald-600"
                              >
                                <Check class="h-3.5 w-3.5" />
                              </Badge>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              <p class="font-bold">Fully Paid</p>
                            </Tooltip.Content>
                          </Tooltip.Root>
                        {:else}
                          <Tooltip.Root>
                            <Tooltip.Trigger>
                              <Badge
                                variant="outline"
                                class="border-sky-500/20 bg-sky-500/10 p-1.5 text-sky-600"
                              >
                                <Clock class="h-3.5 w-3.5" />
                              </Badge>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              <p class="font-bold">Pending Payment</p>
                            </Tooltip.Content>
                          </Tooltip.Root>
                        {/if}

                        {#if r.bal < 0}
                          <Tooltip.Root>
                            <Tooltip.Trigger>
                              <Badge
                                variant="outline"
                                class="border-amber-500/20 bg-amber-500/10 p-1.5 text-amber-600"
                              >
                                <TriangleAlert class="h-3.5 w-3.5" />
                              </Badge>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              <p class="font-bold">Overpaid: Account balance is negative</p>
                            </Tooltip.Content>
                          </Tooltip.Root>
                        {/if}

                        {#if r.bal === 0 && (r.waterBal < 0 || r.assocBal < 0)}
                          <Tooltip.Root>
                            <Tooltip.Trigger>
                              <Badge
                                variant="outline"
                                class="border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-600"
                              >
                                <CircleAlert class="h-3.5 w-3.5" />
                              </Badge>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              <p class="font-bold">Misassigned: Internal balances are negative</p>
                            </Tooltip.Content>
                          </Tooltip.Root>
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
            <p class="font-semibold text-foreground">No residents found.</p>
            <p class="text-xs text-muted-foreground">Adjust filters or search query.</p>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</Tooltip.Provider>
