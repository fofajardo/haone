<script lang="ts">
  import { goto } from "$app/navigation";
  import * as Tabs from "$ui/tabs";
  import { Button } from "$ui/button";
  import { FileSpreadsheet, List, Bed, BookUser, ArrowRightLeft } from "@lucide/svelte";

  let {
    active = "list"
  }: {
    active?: "list" | "rooms" | "officers" | "sync";
  } = $props();

  function handleTabChange(value: string) {
    if (value === "list") {
      goto("/admin/residents");
    } else if (value === "rooms") {
      goto("/admin/residents/rooms");
    } else if (value === "officers") {
      goto("/admin/residents/officers");
    } else if (value === "sync") {
      goto("/admin/residents/sync");
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  <Button size="sm" href="/admin/residents/export" icon={FileSpreadsheet}>Export</Button>

  <Tabs.Root value={active} onValueChange={handleTabChange}>
    <Tabs.List>
      <Tabs.Trigger value="list" class="flex items-center gap-1.5">
        <List class="h-3.5 w-3.5" />
        List
      </Tabs.Trigger>
      <Tabs.Trigger value="rooms" class="flex items-center gap-1.5">
        <Bed class="h-3.5 w-3.5" />
        Rooms
      </Tabs.Trigger>
      <Tabs.Trigger value="officers" class="flex items-center gap-1.5">
        <BookUser class="h-3.5 w-3.5" />
        Officers
      </Tabs.Trigger>
      <Tabs.Trigger value="sync" class="flex items-center gap-1.5">
        <ArrowRightLeft class="h-3.5 w-3.5" />
        Sync
      </Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>
</div>
