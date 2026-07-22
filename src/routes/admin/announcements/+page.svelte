<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Plus, Megaphone } from "@lucide/svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import {
    fetchAnnouncements,
    expireAnnouncement,
    deleteAnnouncement
  } from "$logic/admin-logic";
  import { fetchWithAuth } from "$services/google-sheets-service";
  import { auth } from "$state/auth.svelte";
  import type { AnnouncementRecord } from "$lib/types";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import * as AlertDialog from "$ui/alert-dialog";

  import { TableSync } from "$ui/data-table/table-sync.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { columns } from "./columns";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Combobox } from "$ui/combobox";
  import { Search, FunnelX } from "@lucide/svelte";

  import { getAnnouncementStatus } from "$logic/admin-logic";
  import { AnnouncementStatus } from "$lib/types";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let isExpiring = $state(false);
  let announcementToExpire = $state<string | null>(null);
  let isDeleting = $state(false);
  let announcementToDelete = $state<string | null>(null);
  let isBroadcasting = $state(false);
  let selectedIds = $state(new Set<string>());
  let showBroadcastDialog = $state(false);

  function handleBroadcast() {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one announcement to broadcast.");
      return;
    }
    showBroadcastDialog = true;
  }

  async function confirmBroadcast() {
    isBroadcasting = true;
    showBroadcastDialog = false;
    const ids = Array.from(selectedIds);
    try {
      const resp = await fetchWithAuth(
        "/api/admin/announcements/broadcast",
        "Failed to broadcast",
        {
          method: "POST",
          body: JSON.stringify({ ids })
        }
      );
      const data = await resp.json();
      if (data.success) {
        toast.success(data.message || "Notifications sent to all residents");
        await loadData();
      } else {
        throw new Error(data.error || "Failed to broadcast");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isBroadcasting = false;
    }
  }

  const tableSync = new TableSync({
    initialFilters: { search: "", status: "ALL", tags: "ALL" },
    paramMap: { search: "q", status: "status", tags: "tags" },
    searchKey: "search"
  });

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      announcements = await fetchAnnouncements(true);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  function handleExpire(id: string) {
    announcementToExpire = id;
  }

  async function confirmExpire() {
    if (!announcementToExpire) return;
    isExpiring = true;
    try {
      await expireAnnouncement(announcementToExpire);
      toast.success("Announcement expired");
      announcementToExpire = null;
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isExpiring = false;
    }
  }

  function handleDelete(id: string) {
    announcementToDelete = id;
  }

  async function confirmDelete() {
    if (!announcementToDelete) return;
    isDeleting = true;
    try {
      await deleteAnnouncement(announcementToDelete, auth.accessToken!);
      toast.success("Announcement deleted");
      announcementToDelete = null;
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isDeleting = false;
    }
  }

  onMount(loadData);

  const tagsOptions = $derived.by(() => {
    const set = new Set<string>();
    announcements.forEach((a) => {
      (a.tags || "").split(",").forEach((t) => {
        const val = t.trim();
        if (val) set.add(val);
      });
    });
    return Array.from(set); // NO SORT
  });

  const filteredAnnouncements = $derived.by(() => {
    return announcements
      .filter((a) => {
        const search = tableSync.filters!.search.toLowerCase();
        const status = tableSync.filters!.status;
        const tags = tableSync.filters!.tags;
        const currentStatus = getAnnouncementStatus(a);

        const matchesSearch =
          a.title.toLowerCase().includes(search) || a.content.toLowerCase().includes(search);
        const matchesStatus = status === "ALL" || currentStatus === status;
        const matchesTags =
          tags === "ALL" || (a.tags || "").split(",").some((t) => t.trim() === tags);

        return matchesSearch && matchesStatus && matchesTags;
      })
      .sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
  });

  function resetFilters() {
    tableSync.reset();
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="Announcements" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => loadData()}
          {isLoading}
          icon={RefreshCcw}
        />
        <Button
          variant="secondary"
          size="sm"
          onclick={handleBroadcast}
          isLoading={isBroadcasting}
          icon={Megaphone}
        >
          Broadcast
        </Button>
        <Button size="sm" onclick={() => goto("/admin/announcements/add")} icon={Plus}>New</Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} {isLoading} icon={RefreshCcw} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-4 lg:grid-cols-12">
      <div class="space-y-1 lg:col-span-5">
        <Label>Search</Label>
        <div class="relative">
          <Search
            class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={tableSync.filters!.search}
            placeholder="Search announcements…"
            class="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      <div class="space-y-1 lg:col-span-3">
        <Label>Status</Label>
        <Combobox
          bind:value={tableSync.filters!.status}
          options={[
            { value: "ALL", label: "All Status" },
            { value: AnnouncementStatus.ACTIVE, label: "Active" },
            { value: AnnouncementStatus.FUTURE, label: "Future" },
            { value: AnnouncementStatus.EXPIRED, label: "Expired" }
          ]}
          class="h-9"
        />
      </div>

      <div class="space-y-1 lg:col-span-3">
        <Label>Tags</Label>
        <Combobox
          bind:value={tableSync.filters!.tags}
          options={[
            { value: "ALL", label: "All Tags" },
            ...tagsOptions.map((t) => ({ value: t, label: t }))
          ]}
          class="h-9"
        />
      </div>

      <div class="flex items-end lg:col-span-1">
        <Button
          variant="outline"
          size="sm"
          onclick={resetFilters}
          class="h-9 w-full px-2"
          icon={FunnelX}
        >
          Clear
        </Button>
      </div>
    </div>

    {#if filteredAnnouncements.length > 0}
      <DataTable
        data={filteredAnnouncements}
        {columns}
        pagination={tableSync.pagination}
        onPaginationChange={(p) => (tableSync.pagination = p)}
        onRowClick={(r) => goto(`/admin/announcements/${r.id}`)}
        rowId="id"
        enableSelection={true}
        onSelectionChange={(ids) => (selectedIds = ids)}
        meta={{ onExpire: handleExpire, onDelete: handleDelete }}
      />
    {:else}
      <EmptyView title="No announcements found.">
        {#snippet icon()}
          <Megaphone class="h-8 w-8 text-muted-foreground" />
        {/snippet}
      </EmptyView>
    {/if}
  {/if}
</div>

<AlertDialog.Root
  open={announcementToExpire !== null}
  onOpenChange={(o) => {
    if (!o) announcementToExpire = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Expire Announcement</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to expire this announcement? It will no longer be visible to
        residents.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <Button
        onclick={confirmExpire}
        class="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
        isLoading={isExpiring}
      >
        Expire
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={announcementToDelete !== null}
  onOpenChange={(o) => {
    if (!o) announcementToDelete = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Announcement</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to permanently delete this announcement and all its uploaded images?
        This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <Button onclick={confirmDelete} variant="destructive" isLoading={isDeleting}>
        Delete Permanently
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showBroadcastDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Broadcast Announcements?</AlertDialog.Title>
      <AlertDialog.Description>
        This will send a push notification to <strong>all subscribed residents</strong> for the
        <span class="font-bold">{selectedIds.size}</span> selected announcement(s) immediately. Each notification
        will use its respective announcement title and a snippet of its content.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <Button
        onclick={confirmBroadcast}
        class="bg-brand hover:bg-brand/90"
        isLoading={isBroadcasting}
      >
        Confirm & Broadcast
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
