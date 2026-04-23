<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import type { AnnouncementRecord } from "$lib/schemas";

  let { row } = $props<{ row: any }>();
  let announcement = $derived(row.original as AnnouncementRecord);
  let contentPreview = $derived(announcement.content.replace(/<[^>]*>/g, "").trim());
</script>

<div class="flex flex-col gap-0.5">
  <div class="flex items-center gap-2">
    <span class="line-clamp-1 font-medium">{announcement.title}</span>
    {#if announcement.isAdminOnly}
      <Badge
        variant="outline"
        class="h-4 border-purple-200 bg-purple-100 px-1 text-[10px] font-bold text-purple-700 uppercase"
      >
        Admin Only
      </Badge>
    {/if}
  </div>
  <span class="line-clamp-1 max-w-[300px] break-all text-muted-foreground">
    {contentPreview}
  </span>
</div>
