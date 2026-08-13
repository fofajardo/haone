<script lang="ts">
  let { children } = $props();
  import HeroVisual from "$components/HeroVisual.svelte";
</script>

{#snippet legalNotice()}
  By using this platform, you agree to our <a
    href="/terms"
    class="underline underline-offset-2 transition-colors">Terms of Service</a
  >
  and
  <a href="/privacy" class="underline underline-offset-2 transition-colors">Privacy Policy</a>.
{/snippet}

<div class="relative flex min-h-screen flex-col bg-background md:flex-row">
  <!-- Panel: Hero -->
  <div
    class="relative order-2 flex flex-col justify-between overflow-hidden border-r border-white/5 bg-zinc-950 p-10 text-white md:order-1 lg:w-1/2"
  >
    <div class="relative z-20 flex items-center text-xl font-bold tracking-tight">
      <img src="/ha1_bw.svg" alt="HAOne" class="mr-3 h-8 w-8" />
      HAOne
      <div
        class="ml-2 inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
      >
        Beta
      </div>
    </div>
    <div class="mesh-gradient"></div>
    <div class="h-max-content w-max-content hidden md:block">
      <HeroVisual />
    </div>
    <div class="vignette"></div>
    <p class="relative z-10 mt-5 text-xs">
      {@render legalNotice()}
    </p>
  </div>

  <!-- Panel: Main Content -->
  <div class="relative order-1 flex flex-1 flex-col items-center justify-center p-8">
    <div class="mx-auto flex w-full max-w-100 flex-col justify-center space-y-8">
      {@render children()}
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
      radial-gradient(circle at 50% 80%, #2d5a27 0%, transparent 50%),
      radial-gradient(circle at 10% 90%, #7b1113 0%, transparent 40%),
      radial-gradient(circle at 90% 90%, #4a0a0b 0%, transparent 40%);
    filter: blur(80px);
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
