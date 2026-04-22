<script lang="ts">
  import { cn } from "$lib/utils";
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, XCircle, Plus, Info, Clock } from "lucide-svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import {
    fetchLaundryReservations,
    addLaundryReservation,
    cancelLaundryReservation
  } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { formatDate } from "$lib/receipt-utils";
  import { uiSettings } from "$lib/settings.svelte";
  import { ACCOUNT_COL } from "$lib/schemas";
  import type { LaundryRecord, UserRecord } from "$lib/schemas";
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
  import { parseTime, formatTime } from "$lib/receipt-utils";

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
        status: "ACTIVE",
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
    }
  }

  onMount(() => {
    pageState.title = "Laundry Reservation";
    loadData();
  });

  let userReservations = $derived(
    reservations
      .filter((r) => currentResidentId && r.residentId === currentResidentId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.timeStart.localeCompare(a.timeStart))
  );

  let isRulesOpen = $state(false);
</script>

<div class="space-y-6">
  <SubpageHeader title="Laundry Reservation" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData()} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
        </Button>
        <Button size="sm" onclick={() => (isBookingOpen = true)}>
          <Plus class="mr-2 h-4 w-4" /> Book Slot
        </Button>
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
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0" {...props}>
              <ChevronDown
                class={cn("h-4 w-4 transition-transform duration-200", isRulesOpen && "rotate-180")}
              />
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
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="space-y-6">
      <LaundryCalendar
        {reservations}
        {users}
        currentUserId={currentResidentId}
        onCancelReservation={handleCancel}
        {isCancelling}
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
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-lg font-bold">
            <RefreshCcw class="h-5 w-5 text-brand" /> Your Reservations
          </h3>
          <span class="text-xs font-bold text-muted-foreground uppercase">
            {userReservations.length} total
          </span>
        </div>
        <div class="grid gap-3">
          {#each userReservations as r}
            {@const isPast = new Date(`${r.date}T${r.timeEnd}`) < new Date()}
            <Card.Root
              size="sm"
              class={cn("overflow-hidden transition-all", isPast && "opacity-60")}
            >
              <Card.Content class="flex items-center justify-between p-3 px-4">
                <div class="flex items-center gap-4">
                  <div
                    class={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      r.status === "CANCELLED"
                        ? "bg-slate-100 text-slate-400"
                        : "bg-brand/10 text-brand"
                    )}
                  >
                    <Clock class="h-5 w-5" />
                  </div>
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-2">
                      <span class="font-bold">{formatDate(r.date)}</span>
                      {#if r.status === "CANCELLED"}
                        <span
                          class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black tracking-tighter text-slate-500 uppercase"
                          >Cancelled</span
                        >
                      {:else if isPast}
                        <span
                          class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black tracking-tighter text-slate-500 uppercase"
                          >Completed</span
                        >
                      {/if}
                    </div>
                    <p class="text-xs font-medium text-muted-foreground">
                      {r.timeStart} — {r.timeEnd}
                    </p>
                    <p class="font-mono text-xs text-muted-foreground/50 uppercase">{r.id}</p>
                  </div>
                </div>

                {#if r.status === "ACTIVE" && !isPast}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:bg-destructive/10"
                    onclick={() => handleCancel(r.id)}
                    disabled={isCancelling}
                  >
                    <XCircle class="mr-2 h-4 w-4" /> Cancel
                  </Button>
                {/if}
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<Dialog.Root bind:open={isBookingOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Book Laundry Slot</Dialog.Title>
      <Dialog.Description>Select your preferred date and time. Max 2 hours.</Dialog.Description>
    </Dialog.Header>
    <div class="space-y-6 py-4">
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
          <XCircle class="h-4 w-4" />
          {validationError}
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (isBookingOpen = false)} disabled={isBooking}>
        Cancel
      </Button>
      <Button onclick={handleBook} disabled={!!validationError || isBooking}>
        {#if isBooking}
          <RefreshCcw class="mr-2 h-4 w-4 animate-spin" />
          Processing…
        {:else}
          Confirm Booking
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
