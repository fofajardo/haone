<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { OfficerStatus } from "$lib/schemas";

  let { status } = $props<{ status: string }>();

  const variants: Record<string, any> = {
    [OfficerStatus.ACTIVE]: "default",
    [OfficerStatus.RESIGNED]: "destructive",
    [OfficerStatus.CHANGED_POSITION]: "secondary"
  };

  const labels: Record<string, string> = {
    [OfficerStatus.ACTIVE]: "Active",
    [OfficerStatus.RESIGNED]: "Resigned",
    [OfficerStatus.CHANGED_POSITION]: "Changed Role"
  };
</script>

<Badge variant={variants[status] || "outline"}>
  {labels[status] || status}
</Badge>
