<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "$lib/auth.svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Plus, Megaphone, Clock, Trash2, Edit } from "lucide-svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import {
    fetchAnnouncements,
    addAnnouncement,
    updateAnnouncement,
    expireAnnouncement
  } from "$lib/shared-records-logic";
  import type { AnnouncementRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

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

  async function handleExpire(id: string) {
    if (!confirm("Are you sure you want to expire this announcement?")) return;
    try {
      await expireAnnouncement(id);
      toast.success("Announcement expired");
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  onMount(loadData);

  function isActive(a: AnnouncementRecord) {
    const now = new Date().toISOString().split("T")[0];
    if (a.startDate > now) return false;
    if (a.isIndefinite) return true;
    return a.expiryDate >= now;
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="Announcements" isTopLevel={true}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => loadData()} disabled={isLoading}>
          <RefreshCcw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
        </Button>
        <Button size="sm" onclick={() => goto("/admin/announcements/add")}>
          <Plus class="mr-2 h-4 w-4" /> New
        </Button>
      </div>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading announcements…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4">Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-4">
      {#each announcements as a}
        <Card.Root size="sm" class={!isActive(a) ? "opacity-60 grayscale" : ""}>
          <Card.Content class="flex items-start justify-between gap-4 p-2 px-3">
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <h4 class="font-bold">{a.title}</h4>
                {#if a.isAdminOnly}
                  <div
                    class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 uppercase"
                  >
                    Admin Only
                  </div>
                {/if}
                {#if !isActive(a)}
                  <div
                    class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 uppercase"
                  >
                    Expired/Future
                  </div>
                {/if}
              </div>
              <RichEditor content={a.content} editable={false} />
              <div
                class="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase"
              >
                <span class="flex items-center gap-1"
                  ><Clock class="h-3 w-3" /> Start: {a.startDate}</span
                >
                {#if !a.isIndefinite}
                  <span class="flex items-center gap-1"
                    ><Clock class="h-3 w-3" /> End: {a.expiryDate}</span
                  >
                {:else}
                  <span>Indefinite</span>
                {/if}
              </div>
            </div>
            <div class="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onclick={() => goto(`/admin/announcements/${a.id}`)}
              >
                <Edit class="h-4 w-4" />
              </Button>
              {#if isActive(a)}
                <Button
                  variant="ghost"
                  size="icon"
                  class="text-red-500 hover:text-red-600"
                  onclick={() => handleExpire(a.id)}
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      {:else}
        <EmptyView title="No announcements found.">
          {#snippet icon()}
            <Megaphone class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/each}
    </div>
  {/if}
</div>
