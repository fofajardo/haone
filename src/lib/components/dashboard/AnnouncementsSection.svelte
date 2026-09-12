<script lang="ts">
  import { onMount } from "svelte";
  import { fetchAnnouncements } from "$api/controllers/announcement-controller";
  import type { AnnouncementRecord } from "$lib/types";
  import * as Card from "$ui/card";
  import { ChevronRight, ChevronLeft } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import RichTextRenderer from "$components/editor/RichTextRenderer.svelte";
  import { Badge } from "$ui/badge";
  import { ANNOUNCEMENT_TAG_COLORS } from "$lib/types";
  import { goto } from "$app/navigation";
  import { Skeleton } from "$components/ui/skeleton";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);
  let activeIndex = $state(0);

  async function loadData() {
    try {
      announcements = await fetchAnnouncements();
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  function nextSlide() {
    activeIndex = (activeIndex + 1) % announcements.length;
  }

  function prevSlide() {
    activeIndex = (activeIndex - 1 + announcements.length) % announcements.length;
  }

  onMount(loadData);
</script>

{#if isLoading}
  <Skeleton class="h-175 w-full" />
{:else if announcements.length > 0}
  <Card.Root class="relative mx-auto flex h-175 w-full max-w-full flex-col overflow-hidden">
    <Card.Header class="flex flex-row items-center justify-between">
      <Card.Title>Announcements</Card.Title>
      {#if announcements.length > 1}
        <Card.Action class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            onclick={prevSlide}
            title="Previous"
            aria-label="Previous announcement"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            onclick={nextSlide}
            title="Next"
            aria-label="Next announcement"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </Card.Action>
      {/if}
    </Card.Header>

    <div
      class="flex min-h-0 flex-1 cursor-pointer flex-col transition-colors hover:bg-muted/30"
      onclick={() => goto(`/resident/announcements/${announcements[activeIndex].slug}`)}
      onkeydown={(e) => {
        if (e.key === "Enter") {
          goto(`/resident/announcements/${announcements[activeIndex].slug}`);
        }
      }}
      role="button"
      tabindex="0"
    >
      <div
        class="flex min-h-0 flex-1 transition-transform duration-300 ease-out"
        style="transform: translateX(-{activeIndex * 100}%);"
      >
        {#each announcements as a}
          <div class="relative flex h-full w-full shrink-0 flex-col overflow-hidden">
            <Card.Content class="overflow-hidden">
              <div class="space-y-2">
                <h3 class="text-xl font-bold text-foreground">{a.title}</h3>
                <RichTextRenderer bind:content={a.content} />
              </div>
            </Card.Content>

            <!-- Gradient Fade Overlay -->
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-card to-transparent"
            ></div>
          </div>
        {/each}
      </div>

      <!-- Fixed Footer Block -->
      <div
        class="flex shrink-0 items-center justify-between border-t border-border bg-card p-6 pb-0"
      >
        <div class="flex flex-col gap-5">
          <div class="flex flex-col">
            <span class="text-sm font-medium text-foreground"
              >{announcements[activeIndex].creatorName || "Officer"}</span
            >
            <span class="text-xs text-muted-foreground">
              {new Date(
                announcements[activeIndex].startDate || announcements[activeIndex].dateCreated
              ).toLocaleString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })}
            </span>
          </div>
        </div>

        {#if announcements[activeIndex].tags}
          <div class="flex flex-wrap gap-1">
            {#each announcements[activeIndex].tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean) as tag}
              <Badge
                variant="secondary"
                class="px-2 py-0.5 text-xs {ANNOUNCEMENT_TAG_COLORS[tag.toUpperCase()] ||
                  ANNOUNCEMENT_TAG_COLORS.DEFAULT}"
              >
                {tag}
              </Badge>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Card.Root>
{/if}
