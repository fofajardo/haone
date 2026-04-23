<script lang="ts">
  import { cn } from "$lib/utils";
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, Info, Funnel, CircleX, CircleCheck } from "lucide-svelte";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import {
    fetchLaundryReservations,
    addLaundryReservation,
    cancelLaundryReservation
  } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { type LaundryRecord, type UserRecord, LaundryStatus } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import * as DatePicker from "$lib/components/ui/date-picker";
  import * as TimePicker from "$lib/components/ui/time-picker";
  import LaundryCalendar from "$lib/components/residents/LaundryCalendar.svelte";
  import { toast } from "svelte-sonner";
  import { pageState } from "$lib/page-info.svelte";
  import { ChevronDown } from "lucide-svelte";
  import { parseTime, formatTime, parseDateWeight } from "$lib/receipt-utils";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isBookingOpen = $state(false);
  let isBooking = $state(false);
  let isCancelling = $state(false);

  let newReservation = $state({
    date: new Date().toISOString().split("T")[0],
    timeStart: "05:00",
    timeEnd: "07:00"
  });

  let selectedRow = $state<LaundryRecord | null>(null);
  let statusFilter = $state(LaundryStatus.ACTIVE);

  let currentResidentId = $state("");

  async function loadData() {
    isLoading = true;
    error = null;
    try {
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

      if (!currentResidentId && auth.user?.email) {
        const me = users.find(
          (u) => (u.email || "").toLowerCase() === auth.user?.email.toLowerCase()
        );
        if (me) currentResidentId = me.id;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  const validationError = $derived.by(() => {
    try {
      if (!newReservation.date) return "Please select a date";
      if (!newReservation.timeStart || !newReservation.timeEnd) return "Please provide times";

      const startH = parseTime(newReservation.timeStart);
      const endH = parseTime(newReservation.timeEnd);
      if (isNaN(startH) || isNaN(endH)) return "Invalid time format";

      if (startH >= endH) return "Start must be before end";

      const duration = endH - startH;
      if (duration > 2) return "Max 2 hours allowed";

      const [y, m, d] = newReservation.date.split("-").map(Number);
      const selectedDateTime = new Date(y, m - 1, d, startH);
      const now = new Date();
      const isToday = y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();

      if (isToday) {
        if (startH < now.getHours()) return "Cannot reserve for a past time";
      } else if (selectedDateTime < now) {
        return "Cannot reserve for a past time";
      }

      const maxAdvance = new Date();
      maxAdvance.setDate(now.getDate() + 14);
      if (selectedDateTime > maxAdvance) return "Max 2 weeks in advance";

      if (startH < 5 || endH > 22) return "Open 5 AM - 10 PM only";

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

      if (!currentResidentId) throw new Error("Could not find your resident record.");

      await addLaundryReservation({
        id: crypto.randomUUID(),
        residentId: currentResidentId,
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

  async function handleCancel(id: string) {
    const res = reservations.find((r) => r.id === id);
    if (res) {
      const [y, m, d] = res.date.split("-").map(Number);
      const [h, min] = res.timeEnd.split(":").map(Number);
      if (new Date(y, m - 1, d, h, min) < new Date()) {
        toast.error("Cannot cancel a past reservation");
        return;
      }
    }

    try {
      isCancelling = true;
      await cancelLaundryReservation(id, "Cancelled by user", "CANCELLED_BY_USER");
      toast.success("Reservation cancelled");
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isCancelling = false;
      selectedRow = null;
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
        <Button size="sm" onclick={() => (isBookingOpen = true)} icon={Plus}>Book Slot</Button>
      </div>
    {/snippet}
  </SubpageHeader>

  <Card.Root
    class="overflow-hidden border-blue-100 bg-blue-50/50 p-0 dark:border-blue-800 dark:bg-blue-900/10"
  >
    <Collapsible.Root bind:open={isRulesOpen}>
      <div class="flex items-center justify-between px-4">
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
              class="h-8 w-8 p-0"
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
          <li>Operating Hours: 5:00 AM - 10:00 PM.</li>
          <li>Maximum of two (2) hours for any reservation.</li>
          <li>Maximum of two (2) weeks space for reservation.</li>
          <li>Be present at your reserved hours.</li>
          <li>Be mindful and inform others if you will not be able to attend.</li>
          <li>Inform other residents when done with your laundry.</li>
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  </Card.Root>

  {#if isLoading}
    <LoadingView text="Loading reservations…" />
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
        onCancelReservation={handleCancel}
        {isCancelling}
        bind:selectedReservation={selectedRow}
        onSelectSlot={(date, hour) => {
          // Check if already occupied
          const isOccupied = reservations.some((r: LaundryRecord) => {
            if (r.status !== "ACTIVE" || r.date !== date) return false;
            const start = parseTime(r.timeStart);
            const end = parseTime(r.timeEnd);
            return hour >= start && hour < end;
          });

          if (isOccupied) {
            toast.error("This slot is already booked.");
            return;
          }

          newReservation.date = date;
          newReservation.timeStart = `${hour.toString().padStart(2, "0")}:00`;
          newReservation.timeEnd = `${(hour + 1).toString().padStart(2, "0")}:00`;
          isBookingOpen = true;
        }}
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
            <NativeSelect.Root bind:value={statusFilter} class="h-9 w-[140px] text-xs">
              <NativeSelect.Option value="">All Status</NativeSelect.Option>
              <NativeSelect.Option value={LaundryStatus.ACTIVE}>Active</NativeSelect.Option>
              <NativeSelect.Option value={LaundryStatus.COMPLETED}>Completed</NativeSelect.Option>
              <NativeSelect.Option value={LaundryStatus.CANCELLED_BY_USER}
                >Cancelled</NativeSelect.Option
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

<Dialog.Root bind:open={isBookingOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Book Laundry Slot</Dialog.Title>
      <Dialog.Description
        >Select your preferred date and time. Maximum of 2 hours.</Dialog.Description
      >
    </Dialog.Header>
    <div class="space-y-6 pb-4">
      <div class="space-y-2">
        <Label class="ml-1 text-xs font-bold tracking-wider text-muted-foreground uppercase"
          >Date</Label
        >
        <DatePicker.Root bind:value={newReservation.date} class="w-full" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label class="ml-1 text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >Start Time</Label
          >
          <TimePicker.Root bind:value={newReservation.timeStart} class="w-full" />
        </div>

        <div class="space-y-2">
          <Label class="ml-1 text-xs font-bold tracking-wider text-muted-foreground uppercase"
            >End Time</Label
          >
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
      <Button
        variant="outline"
        onclick={() => (isBookingOpen = false)}
        isLoading={isBooking}
        icon={CircleX}
      >
        Cancel
      </Button>
      <Button
        onclick={handleBook}
        isLoading={isBooking}
        disabled={!!validationError}
        icon={CircleCheck}
      >
        Confirm
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
