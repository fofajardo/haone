<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Combobox } from "$lib/components/ui/combobox";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { LoaderCircle, ChevronLeft, ChevronRight } from "lucide-svelte";
  import colleges from "$lib/colleges.json";
  import programs from "$lib/programs.json";
  import { toast } from "svelte-sonner";
  import { auth } from "$lib/auth.svelte";

  import { roomsState } from "$lib/rooms.svelte";
  import { fetchServer } from "$lib/utils";

  let { status, onSuccess } = $props();

  let isSubmitting = $state(false);
  let step = $state(1);
  let isOutdated = $state(false);

  let formData = $state({
    room: "",
    bed: "",
    studentNo: "",
    college: "",
    program: "",
    firstName: "",
    lastName: "",
    checkInDate: "",
    likedFBPage: false,
    joinedFBGroup: false
  });

  $effect(() => {
    if (status) {
      formData.room = formData.room || status.currEntry?.room || status.account?.room || "";
      formData.bed = formData.bed || status.currEntry?.bed || status.account?.bed || "";
      formData.studentNo =
        formData.studentNo || status.currEntry?.studentNo || status.profile?.studentNo || "";
      formData.college =
        formData.college || status.currEntry?.college || status.profile?.college || "";
      formData.program =
        formData.program || status.currEntry?.program || status.profile?.program || "";
      formData.firstName =
        formData.firstName || status.currEntry?.firstName || status.profile?.firstName || "";
      formData.lastName =
        formData.lastName || status.currEntry?.lastName || status.profile?.lastName || "";
      formData.checkInDate = formData.checkInDate || status.currEntry?.checkInDate || "";
    }
  });

  async function handleSubmit() {
    if (
      !formData.room ||
      !formData.bed ||
      !formData.studentNo ||
      !formData.college ||
      !formData.program ||
      !formData.checkInDate ||
      !formData.likedFBPage ||
      !formData.joinedFBGroup
    ) {
      toast.error("Please fill in all fields.");
      return;
    }

    isSubmitting = true;
    try {
      await fetchServer("/api/resident/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          email: status.profile?.email || auth.user?.email,
          term: status.systemActiveTerm
        })
      });

      toast.success("Registration complete!");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isSubmitting = false;
    }
  }

  const roomOptions = $derived(
    roomsState.config
      .filter((r) => !r.unavailable_reason)
      .map((r) => ({ value: r.room_number, label: r.room_number }))
  );

  const selectedRoomConfig = $derived(
    roomsState.config.find((r) => r.room_number === formData.room)
  );

  const bedOptions = $derived(
    selectedRoomConfig
      ? selectedRoomConfig.slots.map((s) => {
          const isOccupiedByOther = status.occupiedBeds?.some(
            (ob: any) => ob.room === formData.room && ob.bed === s
          );
          return {
            value: s,
            label: `Bed ${s}${isOccupiedByOther ? " (Taken)" : ""}`,
            disabled:
              (!selectedRoomConfig.available_slots.includes(s) || isOccupiedByOther) &&
              formData.bed !== s
          };
        })
      : []
  );

  const collegeOptions = Object.entries(colleges).map(([code, name]) => ({
    value: code,
    label: name as string
  }));

  const programOptions = Object.entries(programs).map(([code, name]) => ({
    value: code,
    label: name as string
  }));

  const isStudentNoDisabled = $derived(
    !!(status.profile?.studentNo || status.currEntry?.studentNo)
  );

  const isAcademicDisabled = $derived(
    !!(status.profile?.college && status.profile?.program && !isOutdated)
  );
</script>

<div class="space-y-6 py-4">
  {#if step === 1}
    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <Label for="room">Room Number</Label>
        <Combobox
          bind:value={formData.room}
          options={roomOptions}
          placeholder="Search room…"
          class="w-full"
        />
      </div>
      <div class="space-y-2">
        <Label for="bed">Bed Assignment</Label>
        <Combobox
          bind:value={formData.bed}
          options={bedOptions}
          placeholder="Select a bed…"
          class="w-full"
          disabled={!formData.room}
        />
      </div>
    </div>

    <div class="space-y-2">
      <Label for="checkInDate">Expected Check-in Date</Label>
      <Input id="checkInDate" type="date" bind:value={formData.checkInDate} class="w-full" />
    </div>

    <div class="flex justify-end">
      <Button onclick={() => (step = 2)}>
        Next
        <ChevronRight class="ml-2 h-4 w-4" />
      </Button>
    </div>
  {:else if step === 2}
    <div class="space-y-4">
      {#if !status.isRegistered}
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="firstName">First Name</Label>
            <Input id="firstName" bind:value={formData.firstName} />
          </div>
          <div class="space-y-2">
            <Label for="lastName">Last Name</Label>
            <Input id="lastName" bind:value={formData.lastName} />
          </div>
        </div>
      {/if}
      <div class="space-y-2">
        <Label for="studentNo">Student Number</Label>
        <Input
          id="studentNo"
          bind:value={formData.studentNo}
          placeholder="XXXX-XXXXX"
          disabled={isStudentNoDisabled}
        />
      </div>
      <div class="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div class="space-y-2">
          <Label>College</Label>
          <Combobox
            bind:value={formData.college}
            options={collegeOptions}
            placeholder="Search college…"
            class="w-full"
            disabled={isAcademicDisabled}
          />
        </div>
        <div class="space-y-2">
          <Label>Degree Program</Label>
          <Combobox
            bind:value={formData.program}
            options={programOptions}
            placeholder="Search program…"
            class="w-full"
            disabled={!formData.college || isAcademicDisabled}
          />
        </div>

        {#if status.profile?.college}
          <div class="flex items-start space-x-3 pt-2">
            <Checkbox id="outdated" bind:checked={isOutdated} />
            <div class="grid gap-1.5 leading-none">
              <Label
                for="outdated"
                class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                My college/degree program details are outdated
              </Label>
              <p class="text-sm text-muted-foreground">
                Checking this allows you to request an update to your academic profile. This will be
                appended to your academic history.
              </p>
            </div>
          </div>
        {/if}
      </div>

      <div class="space-y-4 rounded-xl border bg-muted/20 p-4">
        <p class="text-sm font-bold text-muted-foreground uppercase">Social Media Requirements</p>
        <div class="space-y-3">
          <div class="flex items-start space-x-3">
            <Checkbox id="fb-page" bind:checked={formData.likedFBPage} />
            <div class="grid gap-1.5 leading-none">
              <Label for="fb-page" class="text-sm font-medium">
                I have liked the <a
                  href="https://www.facebook.com/atintcrha.uplb"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary underline hover:text-primary/80"
                >
                  Official Facebook Page
                </a> of the association.
              </Label>
            </div>
          </div>
          <div class="flex items-start space-x-3">
            <Checkbox id="fb-group" bind:checked={formData.joinedFBGroup} />
            <div class="grid gap-1.5 leading-none">
              <Label for="fb-group" class="text-sm font-medium">
                I have joined the <a
                  href="https://www.facebook.com/share/g/19hjZodpeg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary underline hover:text-primary/80"
                >
                  Official Facebook Group
                </a> of the association.
              </Label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex justify-between">
      <Button variant="ghost" onclick={() => (step = 1)}>
        <ChevronLeft class="mr-2 h-4 w-4" />
        Back
      </Button>
      <Button onclick={handleSubmit} disabled={isSubmitting}>
        {#if isSubmitting}
          <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
          Submitting…
        {:else}
          Finish
        {/if}
      </Button>
    </div>
  {/if}
</div>
