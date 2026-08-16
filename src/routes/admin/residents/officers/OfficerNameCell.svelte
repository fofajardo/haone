<script lang="ts">
  import type { OfficerRecord } from "$lib/types";

  let { officer } = $props<{ officer: OfficerRecord }>();
</script>

<div class="flex flex-col">
  <span class="font-medium">
    {officer.name}
  </span>
  <span class="text-muted-foreground">{officer.email}</span>
</div>
