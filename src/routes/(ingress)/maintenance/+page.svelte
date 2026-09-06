<script lang="ts">
  import { Construction, RefreshCcw } from "@lucide/svelte";
  import { Button } from "$ui/button";
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";

  onMount(() => {
    pageState.title = "Under Maintenance";
  });

  function reload() {
    window.location.href = "/";
  }
</script>

<div class="flex flex-col space-y-4 text-center md:text-left">
  <div class="space-y-3">
    <div
      class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 md:mx-0 dark:text-amber-400"
    >
      <Construction class="h-6 w-6" />
    </div>
    <h1 class="font-['Archivo'] text-3xl font-black tracking-tighter text-foreground sm:text-5xl">
      Under Scheduled Maintenance
    </h1>
    <p class="text-base leading-relaxed text-muted-foreground">
      HAOne is currently undergoing system updates. Services will be restored shortly.
    </p>
  </div>
</div>

<div class="grid gap-3">
  <Button
    onclick={reload}
    class="h-14 rounded-xl bg-foreground text-base font-bold text-background transition-all hover:opacity-90 active:scale-[0.98]"
    icon={RefreshCcw}
  >
    Check Again
  </Button>
</div>
