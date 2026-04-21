<script lang="ts">
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Calendar, Clock, XCircle, User, Info } from "lucide-svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import { fetchLaundryReservations, cancelLaundryReservation } from "$lib/shared-records-logic";
  import { fetchUsers } from "$lib/resident-logic";
  import { fetchSheetRowsRaw } from "$lib/google-sheets";
  import { uiSettings } from "$lib/settings.svelte";
  import { ACCOUNT_COL } from "$lib/schemas";
  import type { LaundryRecord, UserRecord } from "$lib/schemas";
  import * as Dialog from "$lib/components/ui/dialog";
  import DataTable from "$lib/components/ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import LaundryCalendar from "$lib/components/residents/LaundryCalendar.svelte";
  import LaundryImportDialog from "$lib/components/admin/LaundryImportDialog.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { toast } from "svelte-sonner";
  import { FileUp } from "lucide-svelte";
  import { pageState } from "$lib/page-info.svelte";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isImportOpen = $state(false);

  let cancelData = $state<{ id: string; reason: string } | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const [resResult, userData, accRows] = await Promise.all([
        fetchLaundryReservations(true),
        fetchUsers(true),
        fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:E", true)
      ]);

      const roomMap = new Map<string, string>();
      // Iterate through all accounts; later entries (newer terms) will overwrite earlier ones
      accRows.slice(1).forEach((row) => {
        const rid = (row[ACCOUNT_COL.RESIDENT_ID] || "").trim();
        const room = (row[ACCOUNT_COL.ROOM] || "").trim();
        if (rid && room) {
          roomMap.set(rid, room);
          roomMap.set(rid.toLowerCase(), room);
        }
      });

      if (Array.isArray(resResult)) {
        reservations = resResult;
      } else {
        reservations = resResult.reservations;
      }
      users = userData.map((u) => ({
        ...u,
        room: roomMap.get(u.id) || roomMap.get((u.email || "").toLowerCase()) || ""
      }));
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
      await cancelLaundryReservation(cancelData.id, cancelData.reason, "CANCELLED_BY_ADMIN");
      toast.success("Reservation cancelled");
      cancelData = null;
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  onMount(() => {
    pageState.title = "Laundry";
    loadData();
  });

  let sortedReservations = $derived(
    [...reservations].sort((a, b) => {
      const da = new Date(`${a.date}T${a.timeStart}`).getTime();
      const db = new Date(`${b.date}T${b.timeStart}`).getTime();
      return db - da; // Newest first
    })
  );

  function isPast(date: string, time: string) {
    return new Date(`${date}T${time}`) < new Date();
  }

  const userMap = $derived(new Map(users.map((u) => [u.id, u])));
</script>

<div class="space-y-6">
  <SubpageHeader title="Laundry" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => (isImportOpen = true)}>
          <FileUp class="mr-2 h-4 w-4" /> Import
        </Button>
        <Button variant="outline" size="sm" onclick={() => loadData()} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  <LaundryImportDialog bind:open={isImportOpen} onComplete={loadData} />

  {#if isLoading}
    <LoadingView text="Loading all reservations…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="space-y-8">
      <LaundryCalendar {reservations} users={users as any[]} currentUserId={auth.user?.email} />
      <div class="space-y-4">
        <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">
          Reservation History
        </h3>

        <DataTable
          data={sortedReservations}
          {columns}
          rowId="id"
          meta={{
            userMap,
            onCancel: (id: string) => (cancelData = { id, reason: "" })
          }}
        />
      </div>
    </div>
  {/if}
</div>

<Dialog.Root open={!!cancelData} onOpenChange={(o) => !o && (cancelData = null)}>
  <Dialog.Content>
    {#if cancelData}
      <Dialog.Header>
        <Dialog.Title>Cancel Reservation</Dialog.Title>
        <Dialog.Description
          >Please provide a reason for cancellation. This will be visible to the resident.</Dialog.Description
        >
      </Dialog.Header>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="reason">Reason</Label>
          <Input
            id="reason"
            placeholder="e.g., Maintenance, Violations, etc."
            bind:value={cancelData.reason}
          />
        </div>
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={() => (cancelData = null)}>Back</Button>
        <Button variant="destructive" onclick={handleCancel}>Cancel Reservation</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
