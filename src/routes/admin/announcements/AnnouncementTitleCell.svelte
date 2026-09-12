<script lang="ts">
  import { Badge } from "$ui/badge";
  import type { AnnouncementRecord } from "$lib/types";

  let { row } = $props<{ row: any }>();
  let announcement = $derived(row.original as AnnouncementRecord);
  let contentPreview = $derived(announcement.content.replace(/<[^>]*>/g, "").trim());
</script>

<div class="flex flex-col gap-0.5">
  <div class="flex items-center gap-2">
    <span class="block max-w-100 truncate font-medium" title={announcement.title}>
      {announcement.title}
    </span>
    {#if announcement.isAdminOnly}
      <Badge
        variant="outline"
        class="h-4 border-purple-200 bg-purple-100 px-1 text-xs font-bold text-purple-700 uppercase"
      >
        Admin Only
      </Badge>
    {/if}
  </div>
  <span class="block max-w-100 truncate text-muted-foreground" title={contentPreview}>
    {contentPreview}
  </span>
</div>
