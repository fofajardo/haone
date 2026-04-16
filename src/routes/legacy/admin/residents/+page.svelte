<script lang="ts">
  import { onMount } from "svelte";
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { formatCurrency, translatePeriod, formatAccounting } from "$lib/receipt-utils";
  import { createEmail, sendEmail } from "$lib/gmail";
  import { auth } from "$lib/auth.svelte";
  import { generatePaymentStatusHtml } from "$lib/templates/payment-status";
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import TermFilter from "$lib/components/TermFilter.svelte";
  import {
    RefreshCcw,
    Users,
    Search,
    Mail,
    ChevronLeft,
    ChevronRight,
    Play,
    CircleCheckBig,
    CircleAlert,
    LoaderCircle,
    Eye,
    ArrowUpDown,
    FilterX
  } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";

  // Account Sheet Column Indices
  const COL = {
    EMAIL: 0,
    PERIOD: 1,
    ROOM: 2,
    BED: 3,
    WATER_PAID: 5,
    WATER_WAIVED: 6,
    WATER_BAL: 7,
    ASSOC_PAID: 9,
    ASSOC_WAIVED: 10,
    ASSOC_BAL: 11,
    PAID: 13,
    WAIVED: 14,
    BAL: 15,
    IS_FULLY_PAID: 18,
    ACCOUNT_FULL_NAME: 19,
    STNO: 24
  };

  interface Resident {
    email: string;
    period: string;
    room: string;
    bed: string;
    name: string;
    stno: string;
    waterPaid: number;
    waterWaived: number;
    waterBal: number;
    assocPaid: number;
    assocWaived: number;
    assocBal: number;
    paid: number;
    waived: number;
    bal: number;
    isFullyPaid: boolean;
    raw: string[];
  }

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

  // Dispatch Mode
  let isDispatchMode = $state(false);
  let isSending = $state(false);
  let isSuccess = $state(false);
  let dispatchProgress = $state({ current: 0, total: 0 });
  let previewIndex = $state(0);

  // Custom Reminders (Rich Text / HTML support)
  let customReminders = $state(`<ul>
  <li>Join our Facebook Messenger Community/Group Chat: https://tr.ee/ati_fbme</li>
  <li>Join our Facebook Group: https://www.facebook.com/groups/618203756704972</li>
  <li>Like our Facebook Page: https://www.facebook.com/atintcrha.uplb</li>
</ul>`);

  function parseAmount(val: any) {
    if (!val) return 0;
    const clean = val.toString().replace(/[₱,]/g, "").trim();
    return parseFloat(clean) || 0;
  }

  async function loadData() {
    if (!brandingState.spreadsheetId) return;
    isLoading = true;
    error = null;
    selectedIndices = new Set();
    try {
      const rows = await fetchSheetRowsRaw(brandingState.spreadsheetId, "accounts!A:AD");
      residents = rows
        .slice(1)
        .map((row) => ({
          email: (row[COL.EMAIL] || "").trim(),
          period: (row[COL.PERIOD] || "").trim(),
          room: (row[COL.ROOM] || "").trim(),
          bed: (row[COL.BED] || "").trim(),
          name: (row[COL.ACCOUNT_FULL_NAME] || "").trim(),
          stno: (row[COL.STNO] || "").trim(),
          waterPaid: parseAmount(row[COL.WATER_PAID]),
          waterWaived: parseAmount(row[COL.WATER_WAIVED]),
          waterBal: parseAmount(row[COL.WATER_BAL]),
          assocPaid: parseAmount(row[COL.ASSOC_PAID]),
          assocWaived: parseAmount(row[COL.ASSOC_WAIVED]),
          assocBal: parseAmount(row[COL.ASSOC_BAL]),
          paid: parseAmount(row[COL.PAID]),
          waived: parseAmount(row[COL.WAIVED]),
          bal: parseAmount(row[COL.BAL]),
          isFullyPaid: (row[COL.IS_FULLY_PAID] || "").toString().toUpperCase() === "YES",
          raw: row
        }))
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

  const stagedResidents = $derived(residents.filter((r) => selectedIndices.has(r.stno)));

  function toggleSelectAll() {
    if (selectedIndices.size === filteredResidents.length) selectedIndices = new Set();
    else selectedIndices = new Set(filteredResidents.map((r) => r.stno));
  }

  function toggleResident(stno: string) {
    if (selectedIndices.has(stno)) selectedIndices.delete(stno);
    else selectedIndices.add(stno);
    selectedIndices = new Set(selectedIndices);
  }

  const emailPreview = $derived.by(() => {
    if (stagedResidents.length === 0 || !stagedResidents[previewIndex]) return { body: "" };
    const r = stagedResidents[previewIndex];
    const branding = brandingState.profile;

    const body = generatePaymentStatusHtml({
      accountName: r.name,
      room: r.room,
      waterPaid: r.waterPaid,
      waterWaived: r.waterWaived,
      waterBal: r.waterBal,
      assocPaid: r.assocPaid,
      assocWaived: r.assocWaived,
      assocBal: r.assocBal,
      paid: r.paid,
      waived: r.waived,
      bal: r.bal,
      isFullyPaid: r.isFullyPaid,
      reminders: customReminders,
      headerImageUrl: branding.emailHeaderUrl,
      replyTo: branding.replyTo
    });

    return { body };
  });

  async function runBatchDispatch() {
    if (!auth.accessToken) return;
    isSending = true;
    isSuccess = false;
    error = null;
    dispatchProgress = { current: 0, total: stagedResidents.length };

    const branding = brandingState.profile;

    for (const r of stagedResidents) {
      try {
        const body = generatePaymentStatusHtml({
          accountName: r.name,
          room: r.room,
          waterPaid: r.waterPaid,
          waterWaived: r.waterWaived,
          waterBal: r.waterBal,
          assocPaid: r.assocPaid,
          assocWaived: r.assocWaived,
          assocBal: r.assocBal,
          paid: r.paid,
          waived: r.waived,
          bal: r.bal,
          isFullyPaid: r.isFullyPaid,
          reminders: customReminders,
          headerImageUrl: branding.emailHeaderUrl,
          replyTo: branding.replyTo
        });

        const subject = `Payment Status Update: ${r.name}`;
        const raw = createEmail(r.email, subject, body, branding.replyTo);
        await sendEmail(auth.accessToken, raw);

        dispatchProgress.current++;
        await new Promise((res) => setTimeout(res, 200));
      } catch (e: any) {
        error = `Failed at ${r.email}: ${e.message}`;
        isSending = false;
        return;
      }
    }

    isSuccess = true;
    isSending = false;
  }
</script>

<div class="space-y-6">
  {#if !isDispatchMode}
    <SubpageHeader title="Residents">
      {#snippet actions()}
        <TermFilter onSelect={loadData} />
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onclick={loadData} disabled={isLoading}>
            <RefreshCcw class="h-4 w-4 sm:mr-2 {isLoading ? 'animate-spin' : ''}" />
            <span class="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            size="sm"
            disabled={selectedIndices.size === 0}
            onclick={() => (isDispatchMode = true)}
          >
            <Mail class="mr-2 h-4 w-4" />
            Batch Status ({selectedIndices.size})
          </Button>
        </div>
      {/snippet}
    </SubpageHeader>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div class="space-y-1.5 lg:col-span-2">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Search</Label>
        <div class="relative">
          <Search class="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            bind:value={filterSearch}
            placeholder="Search by name, email, or room..."
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Room</Label>
        <Select.Root type="single" bind:value={filterRoom}>
          <Select.Trigger class="h-9 text-xs font-semibold">
            {filterRoom === "ALL" ? "All Rooms" : filterRoom}
          </Select.Trigger>
          <Select.Content>
            {#each rooms as room}
              <Select.Item value={room}>{room === "ALL" ? "All Rooms" : room}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <div class="space-y-1.5">
        <Label class="text-[10px] font-bold text-muted-foreground uppercase">Payment Status</Label>
        <Select.Root type="single" bind:value={filterStatus}>
          <Select.Trigger class="h-9 text-xs font-semibold">
            {#if filterStatus === "ALL"}
              All Statuses
            {:else if filterStatus === "FULLY_PAID"}
              Fully Paid
            {:else}
              Pending
            {/if}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="ALL">All Statuses</Select.Item>
            <Select.Item value="FULLY_PAID">Fully Paid</Select.Item>
            <Select.Item value="PENDING">Pending</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex items-end">
        <Button
          variant="ghost"
          size="sm"
          onclick={resetFilters}
          class="h-9 text-xs text-muted-foreground"
        >
          Clear Filters
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
      <Card.Root class="overflow-hidden">
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
                  class="cursor-pointer transition-colors hover:bg-muted/5"
                  onclick={() => toggleResident(r.stno)}
                >
                  <Table.Cell class="px-4 py-3 align-top"
                    ><Checkbox
                      checked={selectedIndices.has(r.stno)}
                      onCheckedChange={() => toggleResident(r.stno)}
                    /></Table.Cell
                  >
                  <Table.Cell class="px-4 py-3 align-top">
                    <div class="flex flex-col">
                      <a
                        href="/legacy/admin/residents/{r.stno}"
                        class="text-xs font-bold text-slate-900 transition-colors hover:text-primary hover:underline"
                        >{r.name}</a
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
  {:else}
    <!-- DISPATCH MODE -->
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-1">
        <button
          onclick={() => (isDispatchMode = false)}
          disabled={isSending}
          class="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-slate-900 disabled:opacity-50"
        >
          <ChevronLeft class="h-3 w-3" /> Back to Directory
        </button>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900">Status Broadcaster</h1>
      </div>
      <Button
        onclick={runBatchDispatch}
        disabled={isSending || isSuccess}
        size="sm"
        class="min-w-[120px]"
      >
        {#if isSending}
          <LoaderCircle class="mr-2 h-4 w-4 animate-spin" /> Sending...
        {:else if isSuccess}
          <CircleCheckBig class="mr-2 h-4 w-4" /> Finished
        {:else}
          <Play class="mr-2 h-4 w-4" /> Start Broadcast
        {/if}
      </Button>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-1">
        <Card.Root>
          <Card.Header><Card.Title class="text-lg">Edit Reminders</Card.Title></Card.Header>
          <Card.Content>
            <Label class="mb-4 block text-[10px] font-bold text-muted-foreground uppercase"
              >Batch Reminders (Rich Text Designer)</Label
            >
            <RichEditor bind:content={customReminders} />
            <p class="mt-4 text-[10px] leading-relaxed text-muted-foreground italic">
              <strong>Tip</strong>: Use the toolbar to add links, bold text, or lists. These will be
              injected directly into the student's email body.
            </p>
          </Card.Content>
        </Card.Root>
      </div>

      <div class="space-y-6 lg:col-span-2">
        <Card.Root>
          <Card.Header class="flex flex-row items-center justify-between">
            <Card.Title class="flex items-center gap-2 text-lg"
              ><Eye class="h-5 w-5" /> Live Preview</Card.Title
            >
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8"
                disabled={previewIndex === 0}
                onclick={() => previewIndex--}><ChevronLeft class="h-4 w-4" /></Button
              >
              <span class="text-xs font-bold tabular-nums"
                >{previewIndex + 1} / {stagedResidents.length}</span
              >
              <Button
                variant="outline"
                size="icon"
                class="h-8 w-8"
                disabled={previewIndex === stagedResidents.length - 1}
                onclick={() => previewIndex++}><ChevronRight class="h-4 w-4" /></Button
              >
            </div>
          </Card.Header>
          <Card.Content>
            <div class="max-h-[700px] overflow-auto rounded-lg border bg-white p-8 shadow-inner">
              {@html emailPreview.body}
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>
