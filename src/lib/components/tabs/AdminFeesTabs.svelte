<script lang="ts">
  import { goto } from "$app/navigation";
  import * as Tabs from "$ui/tabs";
  import { GraduationCap, Tags } from "@lucide/svelte";

  let {
    active = "fee-codes"
  }: {
    active?: "fee-codes" | "terms";
  } = $props();

  function handleTabChange(value: string) {
    if (value === "fee-codes") {
      goto("/admin/fees");
    } else if (value === "terms") {
      goto("/admin/fees/terms");
    }
  }
</script>

<Tabs.Root value={active} onValueChange={handleTabChange}>
  <Tabs.List>
    <Tabs.Trigger value="fee-codes" class="flex items-center gap-1.5">
      <Tags class="h-3.5 w-3.5" />
      Fee Codes
    </Tabs.Trigger>
    <Tabs.Trigger value="terms" class="flex items-center gap-1.5">
      <GraduationCap class="h-3.5 w-3.5" />
      Terms
    </Tabs.Trigger>
  </Tabs.List>
</Tabs.Root>
