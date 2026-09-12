<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, Megaphone, ArrowRight } from "@lucide/svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import ContentHeader from "$components/ContentHeader.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import RichTextEditor from "$components/editor/RichTextEditor.svelte";
  import { fetchAnnouncements } from "$api/controllers/announcement-controller";
  import { type AnnouncementRecord, ANNOUNCEMENT_TAG_COLORS } from "$lib/types";
  import * as Card from "$ui/card";
  import { Badge } from "$ui/badge";
  import { goto } from "$app/navigation";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      announcements = await fetchAnnouncements(bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Announcements";
    loadData();
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Announcements"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  />

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <div class="space-y-4">
      {#each announcements as a}
        <Card.Root
          class="cursor-pointer overflow-hidden border-none bg-card"
          onclick={() => goto(`/resident/announcements/${a.slug}`)}
        >
          <Card.Content class="space-y-4">
            <div class="flex items-start justify-between gap-4">
              <h3 class="text-xl font-bold text-foreground">{a.title}</h3>
              <div class="flex flex-wrap justify-end gap-1.5">
                {#each (a.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean) as tag}
                  <Badge
                    variant="secondary"
                    class={ANNOUNCEMENT_TAG_COLORS[tag.toUpperCase()] ||
                      ANNOUNCEMENT_TAG_COLORS.DEFAULT}
                  >
                    {tag}
                  </Badge>
                {/each}
              </div>
            </div>

            <div class="line-clamp-3 text-sm text-muted-foreground">
              <RichTextEditor content={a.content} editable={false} />
            </div>

            <div class="flex items-center justify-between border-t pt-4">
              <div class="flex flex-col">
                <span class="text-sm font-medium text-foreground">{a.creatorName}</span>
                <span class="flex items-center gap-1 text-xs text-muted-foreground">
                  {new Date(a.startDate || a.dateCreated).toLocaleString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="h-8 text-xs font-bold uppercase"
                icon={ArrowRight}
              >
                Read More
              </Button>
            </div>
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
