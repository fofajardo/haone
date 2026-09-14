<script lang="ts">
  import { cn } from "$lib/utils";
  import { auth } from "$state/auth.svelte";
  import { brandingState } from "$state/branding.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Info } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import {
    checkFeatureEnabled,
    fetchLaundryReservations
  } from "$api/controllers/laundry-controller";
  import { fetchUsers } from "$api/controllers/resident-controller";
  import { type LaundryRecord, type UserRecord } from "$lib/types";
  import * as Card from "$ui/card";
  import * as Collapsible from "$ui/collapsible";
  import LaundryCalendar from "$components/residents/LaundryCalendar.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { ChevronDown } from "@lucide/svelte";
  import CancelLaundryDialog from "$components/forms/CancelLaundryDialog.svelte";
  import BookLaundryDialog from "$components/forms/BookLaundryDialog.svelte";
  import { settings } from "$state/settings.svelte";

  let reservations = $state<LaundryRecord[]>([]);
  let users = $state<UserRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let cancelLaundryDialog = $state<CancelLaundryDialog | null>(null);
  let bookLaundryDialog = $state<BookLaundryDialog | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      await checkFeatureEnabled();

      const [resResult, userData] = await Promise.all([
        fetchLaundryReservations(true),
        fetchUsers(true)
      ]);

      if (Array.isArray(resResult)) {
        reservations = resResult;
      } else {
        reservations = resResult.reservations;
      }
      users = userData;
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

  let userReservations = $derived.by(() => {
    if (!auth.userId) {
      return [];
    }
    return reservations.filter((r) => r.residentId === auth.userId);
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

  let mappedUserReservations = $derived.by(() => {
    return userReservations.map((r) => {
      const resId = (r.residentId || "").trim();
      const user = userMap.get(resId) || userMap.get(resId.toLowerCase());

      return {
        ...r,
        name: (user as any)?.name || r.displayName || "Resident",
        room: (user as any)?.room || r.room || ""
      };
    });
  });

  let isRulesOpen = $state(false);
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Laundry"
    isTopLevel={true}
    onRefresh={() => loadData()}
    isRefreshing={isLoading}
    actions={[{ label: "Book Slot", onclick: () => bookLaundryDialog?.open(), icon: Plus }]}
  />

  <Card.Root
    class="overflow-hidden bg-blue-50/50 p-0 ring-0 dark:border-blue-800 dark:bg-blue-900/10"
  >
    <Collapsible.Root bind:open={isRulesOpen}>
      <div class="flex items-center justify-between pr-2 pl-4">
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
              class="h-8 w-8 rounded-full p-0"
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
          {#each brandingState.profile.laundryRules || [] as rule}
            <li>{rule}</li>
          {/each}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  </Card.Root>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <LaundryCalendar
      {reservations}
      deprecatedMappedReservations={mappedUserReservations}
      {users}
      currentUserId={auth.userId}
      isAdminView={false}
      onCancelReservation={(id) => {
        cancelLaundryDialog?.open(id);
      }}
      onSelectSlot={bookLaundryDialog?.handleSelectSlot}
    />
  {/if}
</div>

<BookLaundryDialog bind:this={bookLaundryDialog} {reservations} onSuccess={() => loadData()} />

<CancelLaundryDialog bind:this={cancelLaundryDialog} isAdmin={false} onSuccess={() => loadData()} />
