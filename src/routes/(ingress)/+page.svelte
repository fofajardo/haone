<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { ArrowRight, LoaderIcon } from "@lucide/svelte";
  import { Button } from "$ui/button";
</script>

<div class="flex flex-col space-y-4 text-center md:text-left">
  <div class="space-y-2">
    <div class="flex items-baseline justify-center gap-3 md:justify-start">
      <h1 class="font-['Archivo'] text-4xl font-black tracking-tighter text-foreground sm:text-6xl">
        Welcome to HAOne
      </h1>
    </div>
    <p class="text-lg leading-relaxed text-muted-foreground">
      The comprehensive administrative suite for UPLB Residence Hall Associations.
    </p>
  </div>
</div>

<div class="grid min-h-14 gap-4">
  {#if !auth.initialized}
    <div class="flex items-center justify-center py-4">
      <LoaderIcon class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  {:else if !auth.accessToken}
    <Button
      href="/sign-in"
      class="h-14 rounded-xl bg-[#7B1113] text-lg font-bold text-white transition-all hover:bg-[#7B1113]/90 active:scale-[0.98]"
    >
      Continue
    </Button>
  {:else}
    <Button
      href="/admin"
      class="h-14 rounded-xl bg-[#7B1113] text-lg font-bold text-white transition-all hover:bg-[#7B1113]/90 active:scale-[0.98]"
      icon={ArrowRight}
    >
      Go to Dashboard
    </Button>
  {/if}
</div>
