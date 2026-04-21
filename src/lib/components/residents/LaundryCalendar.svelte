<script lang="ts">
  import type { LaundryRecord, UserRecord, ResidentRecord } from "$lib/schemas";
  import { auth } from "$lib/auth.svelte";
  import * as Card from "$lib/components/ui/card";
  import { cn } from "$lib/utils";
  import {
    Clock,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    CalendarDays
  } from "lucide-svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Button } from "$lib/components/ui/button";
  import { parseTime, formatTime } from "$lib/receipt-utils";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import {
    Info,
    User as UserIcon,
    Calendar as CalendarIconSmall,
    Clock as ClockIcon,
    XCircle,
    Trash2,
    RefreshCcw
  } from "lucide-svelte";

  let {
    reservations,
    users = [],
    currentUserId,
    onSelectSlot,
    onCancelReservation,
    isCancelling = false
  }: {
    reservations: LaundryRecord[];
    users: (UserRecord | ResidentRecord | any)[];
    currentUserId?: string;
    onSelectSlot?: (date: string, hour: number) => void;
    onCancelReservation?: (id: string) => void;
    isCancelling?: boolean;
  } = $props();

  let selectedDate = $state(new Date());
  let viewMode = $state<"week" | "day">("week");

  const startHour = 5;
  const endHour = 21; // Last slot starts at 9 PM
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  let now = $state(new Date());

  $effect(() => {
    const timer = setInterval(() => {
      now = new Date();
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  });

  const nowTime = $derived(now.getHours() + now.getMinutes() / 60);

  const currentTimeIndicator = $derived.by(() => {
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTotalMinutes = (currentH - startHour) * 60 + currentM;
    const totalGridMinutes = hours.length * 60;

    if (currentTotalMinutes < 0 || currentTotalMinutes >= totalGridMinutes) return null;

    // Position in pixels from the top of the hour grid (Row 2 onwards)
    return { top: currentTotalMinutes };
  });

  const weekDays = $derived.by(() => {
    if (viewMode === "day") {
      const d = new Date(selectedDate);
      d.setHours(0, 0, 0, 0);
      return [d];
    }
    const days = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay()); // Start from Sunday
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  });

  const userMap = $derived(
    new Map(
      users.flatMap((u: any) => {
        // Handle both UserRecord (u.id, u.displayName) and ResidentRecord (u.residentId, u.name)
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

  function formatDate(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getActiveReservationsForDay(date: string) {
    return reservations
      .filter((r: LaundryRecord) => r.status === "ACTIVE" && r.date === date)
      .map((r: LaundryRecord) => {
        const start = parseTime(r.timeStart);
        const end = parseTime(r.timeEnd);
        const resId = (r.residentId || "").trim();
        // Lookup by ID (UUID) or email (legacy)
        const user = userMap.get(resId) || userMap.get(resId.toLowerCase());

        return {
          ...r,
          startHour: start,
          endHour: end,
          duration: end - start,
          name: (user as any)?.name || r.displayName || "Resident",
          room: (user as any)?.room || r.room || ""
        };
      });
  }

  function next() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (viewMode === "week" ? 7 : 1));
    selectedDate = d;
  }

  function prev() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (viewMode === "week" ? 7 : 1));
    selectedDate = d;
  }

  function goToToday() {
    selectedDate = new Date();
  }

  let detailReservation = $state<any>(null);
  let isCancelConfirmOpen = $state(false);

  function handleReservationClick(res: any) {
    detailReservation = res;
  }

  let wasCancelling = $state(false);
  $effect(() => {
    if (wasCancelling && !isCancelling) {
      detailReservation = null;
    }
    wasCancelling = isCancelling;
  });

  function checkIsPast(date: string, timeEnd: string) {
    if (!date || !timeEnd) return false;
    try {
      const [y, m, d] = date.split(/[-/]/).map(Number);
      const timeParts = timeEnd.split(/[:\s]/);
      let h = parseInt(timeParts[0]);
      const min = parseInt(timeParts[1]);

      if (timeEnd.toLowerCase().includes("pm") && h < 12) h += 12;
      if (timeEnd.toLowerCase().includes("am") && h === 12) h = 0;

      const endTime = new Date(y, m - 1, d, h, min);
      return endTime.getTime() <= now.getTime();
    } catch {
      return false;
    }
  }

  let isDetailPast = $derived(
    detailReservation ? checkIsPast(detailReservation.date, detailReservation.timeEnd) : false
  );
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between px-4 py-2">
    <div class="flex items-center gap-4">
      <Button
        variant="outline"
        size="sm"
        class="h-9 rounded-full px-5 text-sm font-medium"
        onclick={goToToday}
      >
        Today
      </Button>

      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full" onclick={prev}>
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full" onclick={next}>
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>

      <h2 class="text-xl font-medium tracking-tight">
        {selectedDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </h2>
    </div>

    <div class="flex items-center gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              variant="outline"
              size="sm"
              class="h-9 rounded-full bg-muted/50 px-4 text-xs font-medium"
              {...props}
            >
              <span class="capitalize">{viewMode}</span>
              <ChevronDown class="ml-1.5 h-3.5 w-3.5 opacity-50" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-32 rounded-xl">
          <DropdownMenu.Item onclick={() => (viewMode = "day")}>Day</DropdownMenu.Item>
          <DropdownMenu.Item onclick={() => (viewMode = "week")}>Week</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>

  <div class="overflow-x-auto">
    <div class={cn(viewMode === "week" ? "min-w-[800px]" : "w-full")}>
      <!-- Unified Grid Container -->
      <div
        class={cn(
          "relative grid overflow-hidden rounded-xl border bg-background",
          viewMode === "week" ? "grid-cols-[60px_repeat(7,1fr)]" : "grid-cols-[60px_1fr]"
        )}
        style="grid-template-rows: 80px repeat({hours.length}, 60px);"
      >
        <!-- Header -->
        <div
          class="flex items-end justify-center border-b bg-muted/30 p-2 text-xs font-semibold text-muted-foreground uppercase"
          style="grid-row: 1; grid-column: 1;"
        >
          Time
        </div>
        {#each weekDays as day, dayIdx}
          <div
            class="space-y-1 border-b border-l bg-muted/30 p-2 text-center"
            style="grid-row: 1; grid-column: {dayIdx + 2};"
          >
            <div
              class={cn(
                "text-xs font-semibold tracking-tight uppercase",
                formatDate(day) === formatDate(now) ? "text-primary" : "text-muted-foreground"
              )}
            >
              {day.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
            <div
              class={cn(
                "mx-auto flex h-10 w-10 items-center justify-center rounded-full text-2xl font-medium transition-colors",
                formatDate(day) === formatDate(now)
                  ? "bg-primary font-bold text-primary-foreground shadow-sm"
                  : "hover:bg-muted"
              )}
            >
              {day.getDate()}
            </div>
          </div>
        {/each}

        <!-- Grid Body -->
        {#each hours as hour, hourIdx}
          <!-- Time Label -->
          <div
            class="flex items-center justify-center border-b bg-muted/5 p-2 text-xs font-bold text-muted-foreground"
            style="grid-row: {hourIdx + 2}; grid-column: 1;"
          >
            {hour.toString().padStart(2, "0")}:00
          </div>

          {#each weekDays as day, dayIdx}
            {@const dateStr = formatDate(day)}
            <!-- Slot Button (Background) -->
            <button
              type="button"
              class="h-[60px] w-full cursor-pointer rounded-none border-b border-l bg-transparent p-0 transition-colors enabled:hover:bg-muted/30"
              style="grid-row: {hourIdx + 2}; grid-column: {dayIdx + 2};"
              disabled={reservations.some((r) => {
                if (r.status !== "ACTIVE" || r.date !== dateStr) return false;
                const start = parseTime(r.timeStart);
                const end = parseTime(r.timeEnd);
                return hour >= start && hour < end;
              })}
              onclick={() => onSelectSlot?.(dateStr, hour)}
              aria-label="Select slot for {dateStr} at {hour}:00"
            ></button>
          {/each}
        {/each}

        {#each weekDays as day, dayIdx}
          {@const isToday = formatDate(day) === formatDate(now)}
          <div
            class="pointer-events-none relative"
            style="grid-row: 2 / span {hours.length}; grid-column: {dayIdx + 2};"
          >
            {#if isToday && currentTimeIndicator}
              <div
                class="absolute z-30 flex w-full items-center"
                style="top: {currentTimeIndicator.top}px; left: 0; right: 0;"
              >
                <div
                  class="absolute left-0 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 shadow-sm"
                ></div>
                <div class="h-0.5 w-full bg-red-500 shadow-sm"></div>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Actual Reservations (Overlaid) -->
        {#each weekDays as day, dayIdx}
          {@const dateStr = formatDate(day)}
          {#each getActiveReservationsForDay(dateStr) as res}
            {@const startRow = Math.max(0, res.startHour - startHour) + 2}
            {@const rowSpan = Math.min(res.duration, endHour - res.startHour + 1)}
            {@const isMine =
              res.residentId === currentUserId ||
              (auth.user?.email && res.residentId === auth.user.email)}
            {@const resEndTime = day.getTime() + res.endHour * 3600000}
            {@const isPast = resEndTime <= now.getTime()}
            {#if startRow >= 2 && rowSpan > 0}
              <button
                type="button"
                class={cn(
                  "relative z-10 m-1 mr-3 flex cursor-pointer flex-col justify-center overflow-hidden rounded-md border-0 p-2 text-left transition-all",
                  isPast
                    ? "bg-emerald-100 dark:bg-emerald-950"
                    : isMine
                      ? "bg-brand"
                      : "bg-emerald-700 dark:bg-emerald-900"
                )}
                style="grid-row: {startRow} / span {rowSpan}; grid-column: {dayIdx + 2};"
                onclick={() => handleReservationClick(res)}
              >
                <div
                  class={cn(
                    "line-clamp-1 w-full text-sm leading-tight font-semibold",
                    isPast ? "text-muted-foreground" : "text-white"
                  )}
                >
                  {res.name}
                </div>
                {#if res.room}
                  <div
                    class={cn(
                      "mt-1 text-xs tracking-wider uppercase",
                      isPast ? "text-muted-foreground" : "text-white"
                    )}
                  >
                    {res.room}
                  </div>
                {/if}
              </button>
            {/if}
          {/each}
        {/each}
      </div>
    </div>
  </div>
  <div
    class="flex items-center gap-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase"
  >
    <div class="flex items-center gap-1.5">
      <div class="h-3 w-3 rounded-sm bg-brand"></div>
      <span>My Reservation</span>
    </div>
    <div class="flex items-center gap-1.5">
      <div class="h-3 w-3 rounded-sm bg-emerald-700 dark:bg-emerald-900"></div>
      <span>Others</span>
    </div>
    <div class="flex items-center gap-1.5">
      <div class="h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-950"></div>
      <span>Past</span>
    </div>
    <div class="flex items-center gap-1.5">
      <div class="h-3 w-3 rounded-sm border border-dashed"></div>
      <span>Available</span>
    </div>
  </div>
</div>

<Sheet.Root open={!!detailReservation} onOpenChange={(o) => !o && (detailReservation = null)}>
  <Sheet.Content side="right" class="sm:max-w-md sm:rounded-l-xl">
    {#if detailReservation}
      {@const isMine =
        detailReservation.residentId === currentUserId ||
        (auth.user?.email && detailReservation.residentId === auth.user.email)}
      <Sheet.Header>
        <Sheet.Title class="flex items-center gap-2">
          <Info class="h-5 w-5 text-primary" />
          Reservation Details
        </Sheet.Title>
        <Sheet.Description>Information about this laundry booking.</Sheet.Description>
      </Sheet.Header>

      <div class="space-y-4 p-4">
        <div class="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <UserIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div class="space-y-0.5">
            <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Reserved By
            </p>
            <p class="text-sm font-semibold">{detailReservation.name}</p>
            {#if detailReservation.room}
              <p class="text-xs text-muted-foreground">Room {detailReservation.room}</p>
            {/if}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2 flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <CalendarIconSmall class="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div class="space-y-0.5">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Date</p>
              <p class="text-sm font-semibold">{detailReservation.date}</p>
            </div>
          </div>
          <div class="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <ClockIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div class="space-y-0.5">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Starts</p>
              <p class="text-sm font-semibold">{detailReservation.timeStart}</p>
            </div>
          </div>
          <div class="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <ClockIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div class="space-y-0.5">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Ends</p>
              <p class="text-sm font-semibold">{detailReservation.timeEnd}</p>
            </div>
          </div>
        </div>

        {#if detailReservation.creationTimestamp}
          <div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <ClockIcon class="h-3 w-3" />
            <span>Booked on {new Date(detailReservation.creationTimestamp).toLocaleString()}</span>
          </div>
        {/if}
      </div>

      <div class="mt-6 flex flex-col gap-2 px-4">
        {#if isMine}
          <Button
            variant="destructive"
            class="w-full"
            disabled={isCancelling || isDetailPast}
            onclick={() => (isCancelConfirmOpen = true)}
          >
            {#if isCancelling}
              <RefreshCcw class="mr-2 h-4 w-4 animate-spin" />
              Cancelling…
            {:else}
              <Trash2 class="mr-2 h-4 w-4" />
              Cancel
            {/if}
          </Button>
        {/if}
        <Button variant="outline" class="w-full" onclick={() => (detailReservation = null)}>
          Close
        </Button>
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>

<AlertDialog.Root bind:open={isCancelConfirmOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Cancel Reservation?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone. This will permanently cancel your laundry reservation.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Go Back</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={() => {
          if (detailReservation) {
            onCancelReservation?.(detailReservation.id);
          }
        }}
        class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
      >
        Confirm
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<style>
  /* Ensure the dialog doesn't close too fast if we want to show the spinner */
</style>
