<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { SquarePen, Trash2 } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import type { AnnouncementRecord } from "$lib/schemas";

  import { getAnnouncementStatus } from "$lib/admin-logic";
  import { AnnouncementStatus } from "$lib/schemas";

  let { row, table } = $props<{ row: any; table: any }>();
  let announcement = $derived(row.original as AnnouncementRecord);

  let isActive = $derived(getAnnouncementStatus(announcement) === AnnouncementStatus.ACTIVE);

  function handleEdit(e: MouseEvent) {
    e.stopPropagation();
    goto(`/admin/announcements/${announcement.id}`);
  }

  function handleExpire(e: MouseEvent) {
    e.stopPropagation();
    // @ts-ignore
    table.options.meta?.onExpire?.(announcement.id);
  }
</script>

<div class="flex justify-end gap-1">
  <Button variant="ghost" size="icon" onclick={handleEdit} class="h-8 w-8">
    <SquarePen class="h-4 w-4" />
  </Button>
  {#if isActive}
    <Button
      variant="ghost"
      size="icon"
      onclick={handleExpire}
      class="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
    >
      <Trash2 class="h-4 w-4" />
    </Button>
  {/if}
</div>
