<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, CircleX, Funnel } from "@lucide/svelte";
  import * as NativeSelect from "$ui/native-select";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import FilterDrawer from "$components/content/FilterDrawer.svelte";
  import {
    fetchAdminLaundryReservations,
    checkFeatureEnabled
  } from "$api/controllers/laundry-controller";
  import {
    computeDisplayNames,
    fetchResidents,
    fetchUsers,
    canAccessLaundry
  } from "$api/controllers/resident-controller";
  import { uiSettings } from "$state/settings.svelte";
  import { LaundryStatus } from "$lib/types";
  import type { LaundryRecord } from "$lib/types";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import CancelLaundryDialog from "$components/forms/CancelLaundryDialog.svelte";
  import BookLaundryDialog from "$components/forms/BookLaundryDialog.svelte";
  import { toast } from "svelte-sonner";
  import { pageState } from "$state/page-info.svelte";
  import { parseTime, parseDateWeight } from "$utils/parsers";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let bookLaundryDialog = $state<BookLaundryDialog | null>(null);
  let selectedReservation = $state<LaundryRecord | null>(null);
  let roomMap = $state(new Map<string, string>());
  let accountToResidentMap = $state(new Map<string, string>());
  let activeResidentIds = $state(new Set<string>());
  let statusFilter = $state<LaundryStatus | "">(LaundryStatus.ACTIVE);
  let cancelLaundryDialog = $state<CancelLaundryDialog | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      await checkFeatureEnabled();

      const [resResult, allUsers, allResidents] = await Promise.all([
        fetchAdminLaundryReservations(true),
        fetchUsers(true),
        fetchResidents(true)
      ]);

      const newRoomMap = new Map<string, string>();
      const newAccToResMap = new Map<string, string>();
      const newActiveResIds = new Set<string>();

      allResidents.forEach((res) => {
        if (
          res.residentId &&
          res.period === uiSettings.activeTerm &&
          canAccessLaundry(res.type || "")
        ) {
          newActiveResIds.add(res.residentId);
        }

        if (res.ledgerId && res.residentId) {
          newAccToResMap.set(res.ledgerId, res.residentId);
        }

        if (res.residentId && res.room) {
          newRoomMap.set(res.residentId, res.room);
          newRoomMap.set(res.residentId.toLowerCase(), res.room);
          if (res.ledgerId) {
            newRoomMap.set(res.ledgerId, res.room);
          }
        }
      });

      const processedUsers = allUsers.map((u) => {
        if (!u.displayName) {
          const computed = computeDisplayNames(u as any);
          u.displayName = computed.displayName;
        }
        return {
          ...u,
          room: newRoomMap.get(u.id) || newRoomMap.get(u.email.toLowerCase()) || ""
        };
      });

      reservations = Array.isArray(resResult) ? resResult : resResult.items;
      users = processedUsers;
      roomMap = newRoomMap;
      accountToResidentMap = newAccToResMap;
      activeResidentIds = newActiveResIds;
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Laundry";
    loadData();
  });

  const userMap = $derived.by(() => {
    const map = new Map<string, any>();
    for (const u of users) {
      if (u.id) map.set(u.id, u);
      if (u.email) map.set(u.email.trim().toLowerCase(), u);
      if (u.studentNo) map.set(u.studentNo.trim(), u);
    }
    return map;
  });

  const activeUsers = $derived(users.filter((u) => activeResidentIds.has(u.id)));

  const filteredReservations = $derived.by(() => {
    // 1. Map and pre-calculate sort key
    const mapped = reservations.map((r) => {
      let rid = (r.residentId || "").trim();
      if (!userMap.has(rid) && accountToResidentMap.has(rid)) {
        rid = accountToResidentMap.get(rid) || rid;
      }
      const user = userMap.get(rid) || userMap.get(rid.toLowerCase());

      let sortKey = parseDateWeight(r.creationTimestamp);
      if (sortKey === 0) {
        sortKey = parseDateWeight(`${r.date} ${r.timeStart}`);
      }

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

      return {
        ...r,
        displayName: user?.displayName || rid,
        room: user?.room || roomMap.get(rid) || roomMap.get(rid.toLowerCase()) || "",
        _sortKey: sortKey,
        _effectiveStatus: effectiveStatus
      };
    });

    // 2. Filter and Sort
    return mapped
      .filter((r) => !statusFilter || r._effectiveStatus === statusFilter)
      .sort((a, b) => b._sortKey - a._sortKey);
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Laundry"
    isTopLevel={true}
    onRefresh={() => loadData()}
    isRefreshing={isLoading}
    actions={[{ label: "Book Slot", onclick: () => bookLaundryDialog?.open(), icon: Plus }]}
  />

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
        users={users as any[]}
        currentUserId={auth.userId}
        isAdminView={true}
        bind:selectedReservation
        onCancelReservation={(id) => {
          cancelLaundryDialog?.open(id);
          selectedReservation = null;
        }}
        onSelectSlot={bookLaundryDialog?.handleSelectSlot}
      />
      <div class="space-y-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Reservation History
          </h3>
          <FilterDrawer activeCount={Number(statusFilter !== "")}>
            <div class="flex items-center gap-2">
              <Funnel class="h-4 w-4 text-muted-foreground" />
              <NativeSelect.Root bind:value={statusFilter} class="h-9 w-full text-xs sm:w-35">
                <NativeSelect.Option value="">All Status</NativeSelect.Option>
                <NativeSelect.Option value={LaundryStatus.ACTIVE}>Active</NativeSelect.Option>
                <NativeSelect.Option value={LaundryStatus.COMPLETED}>Completed</NativeSelect.Option>
                <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_ADMIN}
                  >Cancelled (Admin)</NativeSelect.Option
                >
                <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_USER}
                  >Cancelled (User)</NativeSelect.Option
                >
              </NativeSelect.Root>
            </div>
          </FilterDrawer>
        </div>

        <DataTable
          data={filteredReservations}
          {columns}
          rowId="id"
          onRowClick={(row) => (selectedReservation = row)}
        />
      </div>
    </div>
  {/if}
</div>

<BookLaundryDialog
  bind:this={bookLaundryDialog}
  {reservations}
  isAdmin={true}
  {activeUsers}
  onSuccess={() => loadData()}
/>

<CancelLaundryDialog isAdmin={true} bind:this={cancelLaundryDialog} onSuccess={() => loadData()} />
