<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { ANNOUNCEMENT_TAG_COLORS } from "$lib/schemas";
  import type { AnnouncementRecord } from "$lib/schemas";

  let { row } = $props<{ row: any }>();
  let announcement = $derived(row.original as AnnouncementRecord);
  let tags = $derived(
    (announcement.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  );
</script>

<div class="flex flex-wrap gap-1">
  {#each tags as t}
    <Badge variant="outline" class={ANNOUNCEMENT_TAG_COLORS[t] || ANNOUNCEMENT_TAG_COLORS.DEFAULT}>
      {t}
    </Badge>
  {/each}
</div>
