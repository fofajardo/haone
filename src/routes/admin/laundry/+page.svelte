<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, CircleX, Funnel } from "@lucide/svelte";
  import * as NativeSelect from "$ui/native-select";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import FilterDrawer from "$components/FilterDrawer.svelte";
  import {
    fetchAdminLaundryReservations,
    cancelLaundryReservation,
    addLaundryReservation,
    validateLaundryReservation
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
  import * as Dialog from "$ui/dialog";
  import * as DatePicker from "$ui/date-picker";
  import * as TimePicker from "$ui/time-picker";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import CancelLaundryDialog from "$components/residents/CancelLaundryDialog.svelte";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { toast } from "svelte-sonner";
  import { pageState } from "$state/page-info.svelte";
  import { parseTime, parseDateWeight } from "$utils/parsers";
  import { formatTime } from "$utils/formatters";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isBookingOpen = $state(false);
  let isBooking = $state(false);
  let isCancelling = $state(false);
  let selectedReservation = $state<LaundryRecord | null>(null);
  let roomMap = $state(new Map<string, string>());
  let accountToResidentMap = $state(new Map<string, string>());
  let activeResidentIds = $state(new Set<string>());
  let statusFilter = $state<LaundryStatus>(LaundryStatus.ACTIVE);

  let cancelData = $state<{ id: string; reason: string } | null>(null);

  let newReservation = $state({
    date: new Date().toISOString().split("T")[0],
    timeStart: "05:00",
    timeEnd: "07:00",
    residentId: ""
  });

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [resResult, allUsers, allResidents, currentTerm] = await Promise.all([
        fetchAdminLaundryReservations(true),
        fetchUsers(true),
        fetchResidents(true),
        uiSettings.ensureCurrentTerm()
      ]);

      const newRoomMap = new Map<string, string>();
      const newAccToResMap = new Map<string, string>();
      const newActiveResIds = new Set<string>();

      allResidents.forEach((res) => {
        if (res.residentId && res.period === currentTerm && canAccessLaundry(res.type || "")) {
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

  async function handleCancel(reason: string) {
    if (!cancelData) {
      return;
    }
    try {
      isCancelling = true;
      await cancelLaundryReservation(cancelData.id, reason, "CANCELLED_BY_ADMIN");
      toast.success("Reservation cancelled");
      cancelData = null;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isCancelling = false;
    }
  }

  const validationError = $derived.by(() => {
    return validateLaundryReservation({
      date: newReservation.date,
      timeStart: newReservation.timeStart,
      timeEnd: newReservation.timeEnd,
      residentId: newReservation.residentId,
      isAdmin: true,
      existingReservations: reservations
    });
  });

  async function handleBook() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      isBooking = true;
      await addLaundryReservation(
        {
          id: crypto.randomUUID(),
          residentId: newReservation.residentId,
          date: newReservation.date,
          timeStart: formatTime(newReservation.timeStart),
          timeEnd: formatTime(newReservation.timeEnd),
          status: LaundryStatus.ACTIVE,
          cancelReason: ""
        },
        true
      );
      toast.success("Reservation successful");
      isBookingOpen = false;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isBooking = false;
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

<div class="space-y-3">
  <SubpageHeader
    title="Laundry"
    isTopLevel={true}
    onRefresh={() => loadData()}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <Button size="sm" onclick={() => (isBookingOpen = true)} icon={Plus}>Book Slot</Button>
    {/snippet}
  </SubpageHeader>

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
        currentUserId={auth.user?.email}
        isAdminView={true}
        bind:selectedReservation
        onCancelReservation={(id) => {
          cancelData = { id, reason: "" };
          selectedReservation = null;
        }}
        onSelectSlot={(date, hour) => {
          newReservation.date = date;
          newReservation.timeStart = `${hour.toString().padStart(2, "0")}:00`;
          newReservation.timeEnd = `${(hour + 1).toString().padStart(2, "0")}:00`;
          isBookingOpen = true;
        }}
      />
      <div class="space-y-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Reservation History
          </h3>
          <FilterDrawer activeCount={Number(statusFilter !== "")}>
            <div class="flex items-center gap-2">
              <Funnel class="h-4 w-4 text-muted-foreground" />
              <NativeSelect.Root bind:value={statusFilter} class="h-9 w-full text-xs sm:w-[140px]">
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

<Dialog.Root bind:open={isBookingOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Manual Laundry Booking</Dialog.Title>
      <Dialog.Description>Create a reservation for a resident.</Dialog.Description>
    </Dialog.Header>
    <div class="space-y-6 pb-4">
      <div class="space-y-2">
        <Label>Resident</Label>
        <Combobox
          bind:value={newReservation.residentId}
          options={activeUsers.map((u) => ({
            value: u.id,
            label: `${u.displayName} (${u.room || "No Room"})`
          }))}
          placeholder="Select a resident..."
          searchPlaceholder="Search by name..."
        />
      </div>

      <div class="space-y-2">
        <Label>Date</Label>
        <DatePicker.Root bind:value={newReservation.date} class="w-full" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label>Start Time</Label>
          <TimePicker.Root bind:value={newReservation.timeStart} class="w-full" />
        </div>

        <div class="space-y-2">
          <Label>End Time</Label>
          <TimePicker.Root bind:value={newReservation.timeEnd} class="w-full" />
        </div>
      </div>
      {#if validationError}
        <div class="flex items-center gap-2 px-1 text-xs font-bold text-destructive uppercase">
          <CircleX class="h-4 w-4" />
          {validationError}
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (isBookingOpen = false)} disabled={isBooking}>
        Cancel
      </Button>
      <Button onclick={handleBook} isLoading={isBooking} disabled={!!validationError} icon={Plus}>
        Confirm Booking
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<CancelLaundryDialog
  open={Boolean(cancelData)}
  onOpenChange={(isOpen) => {
    if (!isOpen && !isCancelling) {
      cancelData = null;
    }
  }}
  isAdmin={true}
  {isCancelling}
  onConfirm={handleCancel}
  onCancel={() => {
    cancelData = null;
  }}
/>
