<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { RefreshCcw, Megaphone, Clock } from "lucide-svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import EmptyView from "$lib/components/EmptyView.svelte";
  import RichEditor from "$lib/components/RichEditor.svelte";
  import { fetchAnnouncements } from "$lib/shared-records-logic";
  import type { AnnouncementRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData() {
    isLoading = true;
    error = null;
    try {
      const all = await fetchAnnouncements(true);
      const now = new Date().toISOString().split("T")[0];
      announcements = all
        .filter((a) => {
          if (a.isAdminOnly) return false;
          if (a.startDate > now) return false;
          if (a.isIndefinite) return true;
          return a.expiryDate >= now;
        })
        .sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);
</script>

<div class="space-y-6">
  <SubpageHeader title="Announcements" isTopLevel={true}>
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => loadData()}
        {isLoading}
        icon={RefreshCcw}
      />
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView text="Loading announcements…" />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid gap-6">
      {#each announcements as a}
        <Card.Root class="overflow-hidden border-l-4 border-none border-l-brand bg-card">
          <Card.Content class="space-y-4 p-6">
            <div class="flex items-center justify-between">
              <div class="flex flex-wrap gap-2">
                {#each (a.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean) as tag}
                  <span
                    class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-black tracking-widest text-brand uppercase"
                    >{tag}</span
                  >
                {/each}
              </div>
              <span
                class="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase"
              >
                <Clock class="h-3 w-3 text-brand" />
                {a.startDate}
              </span>
            </div>

            <h3 class="text-2xl font-black tracking-tight text-foreground">{a.title}</h3>

            <RichEditor content={a.content} editable={false} />
          </Card.Content>
        </Card.Root>
      {:else}
        <EmptyView
          title="No active announcements."
          description="Check back later for important updates."
        >
          {#snippet icon()}
            <Megaphone class="h-8 w-8 text-muted-foreground" />
          {/snippet}
        </EmptyView>
      {/each}
    </div>
  {/if}
</div>
