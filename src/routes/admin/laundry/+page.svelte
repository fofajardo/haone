<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Info } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
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
  import { settings } from "$state/settings.svelte";
  import type { LaundryRecord } from "$lib/types";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import CancelLaundryDialog from "$components/forms/CancelLaundryDialog.svelte";
  import BookLaundryDialog from "$components/forms/BookLaundryDialog.svelte";
  import LaundryRulesDialog from "$components/dialogs/LaundryRulesDialog.svelte";
  import { pageState } from "$state/page-info.svelte";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let bookLaundryDialog = $state<BookLaundryDialog | null>(null);
  let roomMap = $state(new Map<string, string>());
  let accountToResidentMap = $state(new Map<string, string>());
  let activeResidentIds = $state(new Set<string>());
  let cancelLaundryDialog = $state<CancelLaundryDialog | null>(null);
  let laundryRulesDialog = $state<LaundryRulesDialog | null>(null);

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
          res.period === settings.activeTerm &&
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
  });

  $effect(() => {
    settings.clockFormat;
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

  const mappedReservations = $derived.by(() => {
    return reservations.map((r) => {
      let rid = (r.residentId || "").trim();
      if (!userMap.has(rid) && accountToResidentMap.has(rid)) {
        rid = accountToResidentMap.get(rid) || rid;
      }
      const user = userMap.get(rid) || userMap.get(rid.toLowerCase());

      return {
        ...r,
        displayName: user?.displayName || rid,
        room: user?.room || roomMap.get(rid) || roomMap.get(rid.toLowerCase()) || ""
      };
    });
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Laundry"
    isTopLevel={true}
    onRefresh={() => loadData()}
    isRefreshing={isLoading}
    actions={[
      {
        label: "Rules",
        onclick: () => laundryRulesDialog?.open(),
        icon: Info,
        variant: "outline"
      },
      {
        label: "Book Slot",
        onclick: () => bookLaundryDialog?.open(),
        icon: Plus
      }
    ]}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <LaundryCalendar
      {reservations}
      deprecatedMappedReservations={mappedReservations}
      users={users as any[]}
      currentUserId={auth.userId}
      isAdminView={true}
      onCancelReservation={(id) => {
        cancelLaundryDialog?.open(id);
      }}
      onSelectSlot={bookLaundryDialog?.handleSelectSlot}
    />
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

<LaundryRulesDialog bind:this={laundryRulesDialog} />
