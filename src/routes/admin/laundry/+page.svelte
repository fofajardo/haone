<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, CircleX, Funnel } from "@lucide/svelte";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import {
    fetchLaundryReservations,
    cancelLaundryReservation,
    addLaundryReservation
  } from "$lib/admin-logic";
  import { computeDisplayNames } from "$lib/resident-logic";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { uiSettings } from "$lib/settings.svelte";
  import { ACCOUNT_COL, USER_COL, LaundryStatus } from "$lib/schemas";
  import type { LaundryRecord } from "$lib/schemas";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as DatePicker from "$lib/components/ui/date-picker";
  import * as TimePicker from "$lib/components/ui/time-picker";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import LaundryCalendar from "$lib/components/residents/LaundryCalendar.svelte";
  import LaundryImportDialog from "$lib/components/admin/LaundryImportDialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Combobox } from "$lib/components/ui/combobox";
  import { toast } from "svelte-sonner";
  import { FileUp } from "@lucide/svelte";
  import { pageState } from "$lib/page-info.svelte";
  import { parseTime, formatTime, parseDateWeight, sortPeriods } from "$lib/receipt-utils";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isImportOpen = $state(false);
  let isBookingOpen = $state(false);
  let isBooking = $state(false);
  let isCancelling = $state(false);
  let selectedReservation = $state<LaundryRecord | null>(null);
  let roomMap = $state(new Map<string, string>());
  let accountToResidentMap = $state(new Map<string, string>());
  let activeResidentIds = $state(new Set<string>());
  let statusFilter = $state(LaundryStatus.ACTIVE);

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
      const [resResult, userRowsRaw, accRows] = await Promise.all([
        fetchLaundryReservations(true),
        fetchSheetRowsRaw(uiSettings.residentRecordsId, "users!A:Z", true),
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:E", true)
      ]);

      const newRoomMap = new Map<string, string>();
      const newAccToResMap = new Map<string, string>();
      const newActiveResIds = new Set<string>();

      // Get current term for filtering active residents
      const periods = Array.from(
        new Set(
          accRows
            .slice(1)
            .map((r) => (r[ACCOUNT_COL.PERIOD] || "").trim())
            .filter(Boolean)
        )
      );
      const latestTerm = sortPeriods(periods)[0] || "";
      const currentTerm = uiSettings.currentTerm || latestTerm;

      // Iterate through all accounts; later entries (newer terms) will overwrite earlier ones
      accRows.slice(1).forEach((row) => {
        const aid = (row[ACCOUNT_COL.ID] || "").trim();
        const rid = (row[ACCOUNT_COL.RESIDENT_ID] || "").trim();
        const period = (row[ACCOUNT_COL.PERIOD] || "").trim();
        const room = (row[ACCOUNT_COL.ROOM] || "").trim();

        if (rid && period === currentTerm) {
          newActiveResIds.add(rid);
        }

        if (aid && rid) {
          newAccToResMap.set(aid, rid);
        }

        if (rid && room) {
          newRoomMap.set(rid, room);
          newRoomMap.set(rid.toLowerCase(), room);
          if (aid) {
            newRoomMap.set(aid, room);
          }
        }
      });

      // Process raw user rows
      const processedUsers = userRowsRaw.slice(1).map((row) => {
        const u = {
          email: (row[USER_COL.EMAIL] || "").trim(),
          id: (row[USER_COL.ID] || "").trim(),
          studentNo: (row[USER_COL.STUDENT_NO] || "").trim(),
          firstName: (row[USER_COL.FIRST_NAME] || "").trim(),
          lastName: (row[USER_COL.LAST_NAME] || "").trim(),
          displayName: (row[USER_COL.DISPLAY_NAME] || "").trim(),
          raw: row
        };
        if (!u.displayName) {
          const computed = computeDisplayNames(u as any);
          u.displayName = computed.displayName;
        }
        return {
          ...u,
          room: newRoomMap.get(u.id) || newRoomMap.get(u.email.toLowerCase()) || ""
        };
      });

      reservations = resResult;
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

  async function handleCancel() {
    if (!cancelData || !cancelData.reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      isCancelling = true;
      await cancelLaundryReservation(cancelData.id, cancelData.reason, "CANCELLED_BY_ADMIN");
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
    try {
      if (!newReservation.date) return "Please select a date";
      if (!newReservation.timeStart || !newReservation.timeEnd) return "Please provide times";
      if (!newReservation.residentId) return "Please select a resident";

      const startH = parseTime(newReservation.timeStart);
      const endH = parseTime(newReservation.timeEnd);
      if (isNaN(startH) || isNaN(endH)) return "Invalid time format";

      if (startH >= endH) return "Start must be before end";

      const duration = endH - startH;
      if (duration > 2) return "Max 2 hours allowed";

      // ADMIN: No past time validation

      if (startH < 5 || endH > 22) return "Facility open 5 AM - 10 PM";

      const isOverlapping = reservations.some((r) => {
        if (r.status !== "ACTIVE" || r.date !== newReservation.date) return false;
        const rStart = parseTime(r.timeStart);
        const rEnd = parseTime(r.timeEnd);
        return startH < rEnd && endH > rStart;
      });
      if (isOverlapping) return "Overlaps with existing booking";

      return null;
    } catch {
      return "Invalid reservation details";
    }
  });

  async function handleBook() {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      isBooking = true;
      const startH = parseTime(newReservation.timeStart);
      const endH = parseTime(newReservation.timeEnd);

      await addLaundryReservation({
        id: crypto.randomUUID(),
        residentId: newReservation.residentId,
        date: newReservation.date,
        timeStart: formatTime(startH),
        timeEnd: formatTime(endH),
        status: LaundryStatus.ACTIVE,
        cancelReason: ""
      });
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

<div class="space-y-6">
  <SubpageHeader title="Laundry" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData()}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button variant="secondary" size="sm" onclick={() => (isImportOpen = true)} icon={FileUp}>
          Import
        </Button>
        <Button size="sm" onclick={() => (isBookingOpen = true)} icon={Plus}>Book Slot</Button>
      </div>
    {/snippet}
  </SubpageHeader>

  <LaundryImportDialog bind:open={isImportOpen} onComplete={loadData} />

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
          <div class="flex items-center gap-2">
            <Funnel class="h-4 w-4 text-muted-foreground" />
            <NativeSelect.Root bind:value={statusFilter} class="h-9 w-[140px] text-xs">
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

<Dialog.Root open={!!cancelData} onOpenChange={(o) => !o && (cancelData = null)}>
  <Dialog.Content class="z-[100]">
    {#if cancelData}
      <Dialog.Header>
        <Dialog.Title>Cancel Reservation</Dialog.Title>
        <Dialog.Description
          >Please provide a reason for cancellation. This will be visible to the resident.</Dialog.Description
        >
      </Dialog.Header>
      <div class="space-y-4 pb-4">
        <div class="space-y-2">
          <Label for="reason">Reason</Label>
          <Input
            id="reason"
            placeholder="e.g., maintenance, violations, etc."
            bind:value={cancelData.reason}
          />
        </div>
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => (cancelData = null)} disabled={isCancelling}>
          Back
        </Button>
        <Button
          variant="destructive"
          onclick={handleCancel}
          isLoading={isCancelling}
          icon={CircleX}
        >
          Cancel Reservation
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

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
