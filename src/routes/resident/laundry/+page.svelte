<script lang="ts">
  import { cn } from "$lib/utils";
  import { auth } from "$state/auth.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Info, Funnel, CircleX } from "@lucide/svelte";
  import * as NativeSelect from "$ui/native-select";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import {
    fetchLaundryReservations,
    cancelLaundryReservation,
    checkFeatureEnabled
  } from "$api/controllers/laundry-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { type LaundryRecord, type UserRecord, LaundryStatus } from "$lib/types";
  import * as Card from "$ui/card";
  import * as Collapsible from "$ui/collapsible";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import { toast } from "svelte-sonner";
  import { pageState } from "$state/page-info.svelte";
  import { ChevronDown } from "@lucide/svelte";
  import { parseTime, parseDateWeight } from "$utils/parsers";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import CancelLaundryDialog from "$components/forms/CancelLaundryDialog.svelte";
  import BookLaundryDialog from "$components/forms/BookLaundryDialog.svelte";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isCancelling = $state(false);
  let cancelTargetId = $state<string | null>(null);
  let bookLaundryDialog = $state<BookLaundryDialog | null>(null);

  let selectedRow = $state<LaundryRecord | null>(null);
  let statusFilter = $state<LaundryStatus>(LaundryStatus.ACTIVE);

  let currentResidentId = $state("");

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      await checkFeatureEnabled();

      const [resResult, userData] = await Promise.all([
        fetchLaundryReservations(true),
        fetchUsers(true)
      ]);

      if (Array.isArray(resResult)) {
        reservations = resResult;
      } else {
        reservations = resResult.reservations;
        currentResidentId = resResult.currentResidentId;
      }
      users = userData;

      if (!currentResidentId && auth.user) {
        currentResidentId = auth.userId;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  function openCancelDialog(id: string) {
    const res = reservations.find((r) => r.id === id);
    if (res) {
      const [y, m, d] = res.date.split("-").map(Number);
      const [h, min] = res.timeEnd.split(":").map(Number);
      if (new Date(y, m - 1, d, h, min) < new Date()) {
        toast.error("Cannot cancel a past reservation");
        return;
      }
    }
    cancelTargetId = id;
    selectedRow = null;
  }

  async function handleConfirmCancel(reason: string) {
    if (!cancelTargetId) {
      return;
    }

    try {
      isCancelling = true;
      await checkFeatureEnabled();
      await cancelLaundryReservation(cancelTargetId, reason, "CANCELLED_BY_USER");
      toast.success("Reservation cancelled");
      cancelTargetId = null;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isCancelling = false;
    }
  }

  onMount(() => {
    pageState.title = "Laundry";
    loadData();
  });

  let userReservations = $derived.by(() => {
    if (!currentResidentId) return [];
    return reservations.filter((r) => r.residentId === currentResidentId);
  });

  const userMap = $derived(
    new Map(
      users.flatMap((u: any) => {
        const name = u.displayName || u.name || "Resident";
        const room = u.room || "";
        const data = { name, room };
        const entries: [string, typeof data][] = [];
        const id = u.id || u.residentId;
        const email = u.email;
        if (id) entries.push([id, data]);
        if (email) entries.push([(email || "").trim().toLowerCase(), data]);
        return entries;
      })
    )
  );

  let filteredReservations = $derived.by(() => {
    return userReservations
      .map((r) => {
        let effectiveStatus = r.status;
        if (r.status === LaundryStatus.ACTIVE) {
          if (r.date && r.timeEnd) {
            const [y, m, day] = r.date.split("-").map(Number);
            const h = parseTime(r.timeEnd);
            const endDt = new Date(y, m - 1, day, h, 0);
            if (!isNaN(endDt.getTime()) && endDt < new Date()) {
              effectiveStatus = LaundryStatus.COMPLETED;
            }
          }
        }

        let sortKey = parseDateWeight(r.creationTimestamp);
        if (sortKey === 0) {
          sortKey = parseDateWeight(`${r.date} ${r.timeStart}`);
        }

        const resId = (r.residentId || "").trim();
        const user = userMap.get(resId) || userMap.get(resId.toLowerCase());

        return {
          ...r,
          name: (user as any)?.name || r.displayName || "Resident",
          room: (user as any)?.room || r.room || "",
          _sortKey: sortKey,
          _effectiveStatus: effectiveStatus
        };
      })
      .filter((r) => !statusFilter || r._effectiveStatus === statusFilter)
      .sort((a, b) => b._sortKey - a._sortKey);
  });

  let isRulesOpen = $state(false);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Laundry"
    isTopLevel={true}
    onRefresh={() => loadData()}
    isRefreshing={isLoading}
    actions={[{ label: "Book Slot", onclick: () => bookLaundryDialog?.open(), icon: Plus }]}
  />

  <Card.Root
    class="overflow-hidden bg-blue-50/50 p-0 ring-0 dark:border-blue-800 dark:bg-blue-900/10"
  >
    <Collapsible.Root bind:open={isRulesOpen}>
      <div class="flex items-center justify-between pr-2 pl-4">
        <h4
          class="flex items-center gap-2 text-sm font-bold text-blue-900 uppercase dark:text-blue-100"
        >
          <Info class="h-4 w-4" /> Laundry Rules & Guidelines
        </h4>
        <Collapsible.Trigger>
          {#snippet child({ props })}
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 rounded-full p-0"
              {...props}
              icon={ChevronDown}
              iconClass={cn("transition-transform duration-200", isRulesOpen && "rotate-180")}
            >
              <span class="sr-only">Toggle</span>
            </Button>
          {/snippet}
        </Collapsible.Trigger>
      </div>
      <Collapsible.Content>
        <ul
          class="list-disc space-y-1.5 border-t border-blue-100 px-8 py-4 text-sm text-blue-900/70 dark:border-blue-800 dark:text-blue-100/70"
        >
          {#each brandingState.profile.laundryRules || [] as rule}
            <li>{rule}</li>
          {/each}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  </Card.Root>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <div class="space-y-6">
      <LaundryCalendar
        {reservations}
        {users}
        currentUserId={currentResidentId}
        isAdminView={false}
        onCancelReservation={openCancelDialog}
        {isCancelling}
        bind:selectedReservation={selectedRow}
        onSelectSlot={bookLaundryDialog?.handleSelectSlot}
      />
    </div>

    {#if userReservations.length > 0}
      <div class="space-y-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Reservation History
          </h3>
          <div class="flex items-center gap-2">
            <Funnel class="h-4 w-4 text-muted-foreground" />
            <NativeSelect.Root bind:value={statusFilter} class="h-9 w-35 text-xs">
              <NativeSelect.Option value="">All Status</NativeSelect.Option>
              <NativeSelect.Option value={LaundryStatus.ACTIVE}>Active</NativeSelect.Option>
              <NativeSelect.Option value={LaundryStatus.COMPLETED}>Completed</NativeSelect.Option>
              <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_USER}
                >Cancelled (User)</NativeSelect.Option
              >
              <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_ADMIN}
                >Cancelled (Admin)</NativeSelect.Option
              >
            </NativeSelect.Root>
          </div>
        </div>
        {#if filteredReservations.length > 0}
          <DataTable
            data={filteredReservations}
            {columns}
            rowId="id"
            onRowClick={(row) => (selectedRow = row)}
          />
        {:else}
          <EmptyView
            title="No matching reservations"
            description="No reservations match the selected status filter."
          >
            {#snippet icon()}
              <CircleX class="h-10 w-10 text-muted-foreground/40" />
            {/snippet}
          </EmptyView>
        {/if}
      </div>
    {:else}
      <div class="space-y-4">
        <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">
          Reservation History
        </h3>
        <EmptyView
          title="No reservations found"
          description="Your laundry reservation history will appear here once you start booking slots."
        >
          {#snippet icon()}
            <Plus class="h-10 w-10 text-muted-foreground/40" />
          {/snippet}
        </EmptyView>
      </div>
    {/if}
  {/if}
</div>

<BookLaundryDialog bind:this={bookLaundryDialog} {reservations} onSuccess={() => loadData()} />

<CancelLaundryDialog
  open={Boolean(cancelTargetId)}
  onOpenChange={(isOpen) => {
    if (!isOpen && !isCancelling) {
      cancelTargetId = null;
    }
  }}
  {isCancelling}
  isAdmin={false}
  onConfirm={handleConfirmCancel}
  onCancel={() => {
    cancelTargetId = null;
  }}
/>
