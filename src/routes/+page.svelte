<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { pageState } from "$lib/page-info.svelte";
  import { auth } from "$lib/auth.svelte";
  import { ArrowRight, LogIn, LayoutDashboard, ExternalLink, LoaderCircle } from "lucide-svelte";
  import branding from "$lib/branding.json";
  import { Button } from "$lib/components/ui/button";
  import HeroVisual from "$lib/components/HeroVisual.svelte";

  onMount(() => {
    document.body.classList.add("overflow-hidden");
  });

  onDestroy(() => {
    if (browser) {
      document.body.classList.remove("overflow-hidden");
    }
  });
</script>

<div class="relative flex min-h-screen flex-col bg-background md:flex-row">
  <!-- Left Panel: Brand & Quote -->
  <div
    class="relative hidden flex-col justify-between overflow-hidden border-r border-white/5 bg-zinc-950 p-10 text-white lg:flex lg:w-1/2"
  >
    <div class="mesh-gradient"></div>
    <HeroVisual />
    <div class="vignette"></div>

    <div class="relative z-20 flex items-center text-xl font-bold tracking-tight">
      <img src="/ha1_bw.svg" alt="HAOne" class="mr-3 h-8 w-8" />
      HAOne
    </div>
  </div>

  <!-- Right Panel: Main Content -->
  <div class="relative flex flex-1 flex-col items-center justify-center p-8">
    <div class="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-8">
      <div class="flex flex-col space-y-4 text-center md:text-left">
        <div class="flex justify-center md:justify-start lg:hidden">
          <img src="/ha1.svg" alt="HAOne Logo" class="mb-4 h-16 w-16 dark:hidden" />
          <img src="/ha1_bw.svg" alt="HAOne Logo" class="mb-4 hidden h-16 w-16 dark:block" />
        </div>

        <div class="space-y-2">
          <div class="flex items-baseline justify-center gap-3 md:justify-start">
            <h1
              class="font-['Archivo'] text-4xl font-black tracking-tighter text-foreground sm:text-6xl"
            >
              HAOne
            </h1>
            <div
              class="inline-flex items-center rounded-full bg-[#7B1113]/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#7B1113] uppercase dark:bg-white/10 dark:text-white"
            >
              Beta
            </div>
          </div>
          <p class="text-lg leading-relaxed text-muted-foreground">
            The comprehensive administrative suite for UPLB Residence Hall Associations.
          </p>
        </div>
      </div>

      <div class="grid min-h-[56px] gap-4">
        {#if !auth.initialized}
          <div class="flex items-center justify-center py-4">
            <LoaderCircle class="h-6 w-6 animate-spin text-muted-foreground" />
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
          >
            <ArrowRight class="mr-2 h-5 w-5" />
            Go to Dashboard
          </Button>
        {/if}

        <p class="px-8 text-center text-xs text-muted-foreground md:px-0 md:text-left">
          By entering, you agree to our <a
            href="/terms"
            class="underline underline-offset-2 transition-colors hover:text-foreground"
            >Terms of Service</a
          >
          and
          <a
            href="/privacy"
            class="underline underline-offset-2 transition-colors hover:text-foreground"
            >Privacy Policy</a
          >.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .mesh-gradient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 30%, #7b1113 0%, transparent 40%),
      radial-gradient(circle at 80% 20%, #4a0a0b 0%, transparent 40%),
      radial-gradient(circle at 50% 80%, #2d0607 0%, transparent 50%),
      radial-gradient(circle at 10% 90%, #7b1113 0%, transparent 40%),
      radial-gradient(circle at 90% 90%, #4a0a0b 0%, transparent 40%);
    filter: blur(60px);
    opacity: 0.6;
    animation: aurora 30s ease-in-out infinite alternate;
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%);
    pointer-events: none;
  }

  @keyframes aurora {
    0% {
      transform: scale(1) rotate(0deg);
    }
    33% {
      transform: scale(1.2) rotate(2deg);
    }
    66% {
      transform: scale(1.1) rotate(-2deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }
</style>
