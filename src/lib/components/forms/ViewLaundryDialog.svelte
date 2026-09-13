<script lang="ts">
  import {
    Info,
    UserIcon,
    ClockIcon,
    TrashIcon,
    CalendarPlusIcon,
    Share2Icon,
    CalendarIcon
  } from "@lucide/svelte";
  import * as Sheet from "$ui/sheet";
  import { Button } from "$components/ui/button";
  import { checkIsPast, generateIcsFile, getGoogleCalendarUrl } from "$utils/calendar";
  import { brandingState } from "$state/branding.svelte";

  let {
    currentUserId = "",
    isAdminView = false,
    onCancelReservation,
    selectedReservation = $bindable(null)
  }: {
    currentUserId?: string;
    isAdminView?: boolean;
    onCancelReservation?: (id: string) => void;
    selectedReservation?: any;
  } = $props();

  let isDetailPast = $derived(
    selectedReservation ? checkIsPast(selectedReservation.date, selectedReservation.timeEnd) : false
  );
</script>

<Sheet.Root open={!!selectedReservation} onOpenChange={(o) => !o && (selectedReservation = null)}>
  <Sheet.Content side="right" class="sm:max-w-md sm:rounded-l-xl">
    {#if selectedReservation}
      {@const isMine = selectedReservation.residentId === currentUserId}
      <Sheet.Header>
        <Sheet.Title class="flex items-center gap-2">
          <Info class="h-5 w-5 text-primary" />
          Reservation Details
        </Sheet.Title>
        <Sheet.Description>Information about this laundry booking.</Sheet.Description>
      </Sheet.Header>

      <div class="space-y-4 px-4">
        <div class="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <UserIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div class="space-y-0.5">
            <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Reserved By
            </p>
            <p class="text-sm font-semibold">{selectedReservation.name}</p>
            {#if selectedReservation.room}
              <p class="text-xs text-muted-foreground">Room {selectedReservation.room}</p>
            {/if}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2 flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <CalendarIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div class="space-y-0.5">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Date</p>
              <p class="text-sm font-semibold">{selectedReservation.date}</p>
            </div>
          </div>
          <div class="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <ClockIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div class="space-y-0.5">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Starts</p>
              <p class="text-sm font-semibold">{selectedReservation.timeStart}</p>
            </div>
          </div>
          <div class="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <ClockIcon class="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div class="space-y-0.5">
              <p class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Ends</p>
              <p class="text-sm font-semibold">{selectedReservation.timeEnd}</p>
            </div>
          </div>
        </div>

        {#if selectedReservation.creationTimestamp}
          <div class="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <ClockIcon class="h-3 w-3" />
            <span>Booked on {new Date(selectedReservation.creationTimestamp).toLocaleString()}</span
            >
          </div>
        {/if}

        {#if isMine || isAdminView}
          <div class="space-y-2 pt-2">
            <p class="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Add to Calendar
            </p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                size="sm"
                onclick={() =>
                  generateIcsFile(selectedReservation, brandingState.profile.shortName)}
                icon={CalendarPlusIcon}
              >
                Download .ics
              </Button>
              <Button
                variant="outline"
                size="sm"
                href={getGoogleCalendarUrl(selectedReservation, brandingState.profile.shortName)}
                target="_blank"
                icon={Share2Icon}
              >
                Google Calendar
              </Button>
            </div>
          </div>
        {/if}
      </div>

      <div class="mt-6 flex flex-col gap-2 px-4">
        {#if isMine || isAdminView}
          <Button
            variant="destructive"
            class="w-full"
            disabled={isDetailPast}
            onclick={() => {
              const targetId = selectedReservation.id;
              selectedReservation = null;
              onCancelReservation?.(targetId);
            }}
            icon={TrashIcon}
          >
            Cancel
          </Button>
        {/if}
        <Button variant="outline" class="w-full" onclick={() => (selectedReservation = null)}>
          Close
        </Button>
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
