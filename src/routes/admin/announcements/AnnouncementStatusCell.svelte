<script lang="ts">
  import { Badge } from "$ui/badge";
  import { ANNOUNCEMENT_STATUS_COLORS } from "$lib/types";
  import { getAnnouncementStatus } from "$logic/admin-logic";
  import type { AnnouncementRecord } from "$lib/types";

  let { row } = $props<{ row: any }>();
  let announcement = $derived(row.original as AnnouncementRecord);
  let status = $derived(getAnnouncementStatus(announcement));
  let colorClass = $derived(
    ANNOUNCEMENT_STATUS_COLORS[status] || ANNOUNCEMENT_STATUS_COLORS.DEFAULT
  );
</script>

<Badge variant="outline" class="uppercase {colorClass}">
  {status}
</Badge>
