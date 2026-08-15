<script lang="ts">
  import * as Tabs from "$ui/tabs";
  import { Calendar, Globe } from "@lucide/svelte";

  let {
    value = $bindable("global")
  }: {
    value?: string;
  } = $props();
</script>

<Tabs.Root bind:value>
  <Tabs.List>
    <Tabs.Trigger value="term" class="flex items-center gap-1.5">
      <Calendar class="h-3.5 w-3.5" />
      Term
    </Tabs.Trigger>
    <Tabs.Trigger value="global" class="flex items-center gap-1.5">
      <Globe class="h-3.5 w-3.5" />
      Global
    </Tabs.Trigger>
  </Tabs.List>
</Tabs.Root>
