<script lang="ts">
  import { Button } from "$ui/button";
  import { ChevronLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import RichEditor from "$components/RichEditor.svelte";
  import { ANNOUNCEMENT_TAG_COLORS } from "$lib/types";
  import { Badge } from "$ui/badge";

  let { data } = $props();

  let announcement = $derived(data.announcement);
  let error = $derived.by(() => {
    if (data.error === "expired") {
      return "This announcement has expired and is no longer available.";
    }
    if (data.error === "not_found") {
      return "Announcement not found.";
    }
    return data.error || null;
  });
  let isLoading = $derived(!data.announcement && !data.error);
</script>

<div class="space-y-8">
  <div class="flex items-center gap-2">
    <Button variant="ghost" size="sm" href="/resident/announcements" icon={ChevronLeft}>
      Back to Feed
    </Button>
  </div>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error} />
  {:else if announcement}
    <div class="border-b pb-8">
      <div class="mx-auto max-w-4xl px-6">
        <div class="space-y-6">
          <div class="flex flex-wrap gap-2">
            {#each (announcement.tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean) as tag}
              <Badge
                variant="secondary"
                class="{ANNOUNCEMENT_TAG_COLORS[tag.toUpperCase()] ||
                  ANNOUNCEMENT_TAG_COLORS.DEFAULT} border"
              >
                {tag}
              </Badge>
            {/each}
          </div>

          <h1 class="text-4xl font-black tracking-tight text-foreground lg:text-5xl">
            {announcement.title}
          </h1>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-4xl px-6 pb-12">
      <div class="prose prose-slate dark:prose-invert max-w-none">
        <RichEditor content={announcement.content} editable={false} />
      </div>

      <div class="mt-12 flex flex-col border-t pt-8">
        <span class="text-sm font-medium text-foreground">{announcement.creatorName}</span>
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          {new Date(announcement.startDate || announcement.dateCreated).toLocaleString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
          })}
        </span>
      </div>
    </div>
  {/if}
</div>
