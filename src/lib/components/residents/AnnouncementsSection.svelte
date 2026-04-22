<script lang="ts">
  import { onMount } from "svelte";
  import { fetchAnnouncements } from "$lib/shared-records-logic";
  import type { AnnouncementRecord } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card";
  import { Clock, ChevronRight } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import RichEditor from "$lib/components/RichEditor.svelte";

  let announcements = $state<AnnouncementRecord[]>([]);
  let isLoading = $state(true);

  async function loadData() {
    try {
      const all = await fetchAnnouncements();
      const now = new Date().toISOString().split("T")[0];
      announcements = all
        .filter((a) => {
          if (a.isAdminOnly) return false;
          if (a.startDate > now) return false;
          if (a.isIndefinite) return true;
          return a.expiryDate >= now;
        })
        .sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(loadData);
</script>

{#if !isLoading && announcements.length > 0}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-xl font-bold text-foreground">Announcements</h2>
      <Button variant="ghost" size="sm" href="/resident/announcements">
        View All <ChevronRight class="ml-1 h-4 w-4" />
      </Button>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each announcements.slice(0, 3) as a}
        <Card.Root
          size="sm"
          class="overflow-hidden border-l-4 border-none border-l-brand bg-card transition-all"
        >
          <Card.Content class="space-y-3 p-4">
            <div class="flex items-center justify-between">
              <div class="flex flex-wrap gap-1">
                {#each (a.tags || "")
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean) as tag}
                  <span
                    class="rounded-full bg-brand/10 px-1.5 py-0.5 text-xs font-black tracking-tighter text-brand uppercase"
                    >{tag}</span
                  >
                {/each}
              </div>
              <span
                class="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase"
              >
                <Clock class="h-2.5 w-2.5" />
                {a.startDate}
              </span>
            </div>
            <h3 class="line-clamp-1 leading-tight font-black text-foreground">{a.title}</h3>
            <RichEditor content={a.content} editable={false} />
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </div>
{/if}
