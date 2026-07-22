<script lang="ts">
  import { onMount } from "svelte";
  import { fetchAnnouncements } from "$lib/logic/shared-records-logic";
  import type { AnnouncementRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import { ChevronRight, ChevronLeft } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import RichEditor from "$lib/components/RichEditor.svelte";

  import { Badge } from "$lib/components/ui/badge";
  import { ANNOUNCEMENT_TAG_COLORS } from "$lib/schemas";
  import { goto } from "$app/navigation";

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

{#if !isLoading && announcements.length > 0}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-xl font-bold text-foreground">Announcements</h2>
      <div class="flex items-center gap-2">
        {#if announcements.length > 1}
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
        {/if}
      </div>
    </div>

    <div
      class="relative w-full max-w-full mx-auto overflow-hidden rounded-xl border bg-card cursor-pointer transition-colors hover:bg-muted/30"
      onclick={() => goto(`/resident/announcements/${announcements[activeIndex].slug}`)}
      onkeydown={(e) =>
        e.key === "Enter" && goto(`/resident/announcements/${announcements[activeIndex].slug}`)}
      role="button"
      tabindex="0"
    >
      <div
        class="flex transition-transform duration-300 ease-out"
        style="transform: translateX(-{activeIndex * 100}%);"
      >
        {#each announcements as a}
          <div class="w-full shrink-0">
            <Card.Content class="space-y-4 p-6 pb-2">
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="text-xl font-bold text-foreground flex-1 line-clamp-1">{a.title}</h3>
                  <div class="flex flex-wrap gap-1 shrink-0">
                    {#each (a.tags || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean) as tag}
                      <Badge
                        variant="secondary"
                        class="text-xs py-0.5 px-2 {ANNOUNCEMENT_TAG_COLORS[tag.toUpperCase()] ||
                          ANNOUNCEMENT_TAG_COLORS.DEFAULT}"
                      >
                        {tag}
                      </Badge>
                    {/each}
                  </div>
                </div>

                <div class="line-clamp-8 text-sm text-muted-foreground">
                  <RichEditor content={a.content} editable={false} />
                </div>
              </div>
            </Card.Content>
          </div>
        {/each}
      </div>

      <!-- Fixed Footer Block -->
      <div class="flex items-center justify-between border-t border-border p-6 bg-card shrink-0">
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

        {#if announcements.length > 1}
          <div class="flex gap-1 items-center">
            {#each announcements as _, idx}
              <button
                onclick={(e) => {
                  e.stopPropagation();
                  activeIndex = idx;
                }}
                class="h-1.5 rounded-full transition-all {activeIndex === idx
                  ? 'w-4 bg-brand'
                  : 'w-1.5 bg-muted-foreground/35'}"
                aria-label="Go to announcement slide {idx + 1}"
              ></button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
