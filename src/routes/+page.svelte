<script lang="ts">
  import { pageState } from "$lib/page-info.svelte";
  import { ArrowRight } from "lucide-svelte";

  $effect(() => {
    pageState.title = "Coming Soon";
  });
</script>

<div
  class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 text-white selection:bg-yellow-400/30"
>
  <div class="starfield absolute inset-0 z-0"></div>
  <div class="starfield-fast absolute inset-0 z-0"></div>

  <div class="relative z-10 flex flex-col items-center space-y-12 text-center">
    <div>
      <img src="/ha1.svg" alt="HAOne Logo" class="h-32 w-32" />
    </div>

    <div class="space-y-6">
      <div class="space-y-2">
        <h1
          class="font-['Archivo'] text-6xl font-black tracking-tighter text-[#FFE81F] sm:text-8xl md:drop-shadow-[0_0_10px_rgba(255,232,31,0.5)]"
        >
          HAOne
        </h1>
        <div
          class="mx-auto h-[2px] w-32 bg-gradient-to-r from-transparent via-[#FFE81F] to-transparent"
        ></div>
      </div>

      <div
        class="inline-flex items-center rounded-sm bg-[#FFE81F]/5 px-6 py-1.5 text-xs font-bold tracking-[0.3em] text-[#FFE81F] uppercase backdrop-blur-sm"
      >
        Coming Soon
      </div>
    </div>

    <div class="pt-10">
      <a
        href="/admin"
        class="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-md border border-[#FFE81F]/20 bg-black px-10 py-4 text-sm font-bold tracking-widest text-[#FFE81F] uppercase transition-all duration-500 hover:border-[#FFE81F] hover:bg-[#FFE81F] hover:text-black hover:shadow-[0_0_20px_rgba(255,232,31,0.4)]"
      >
        <span>Enter Command Deck</span>
        <ArrowRight
          size={18}
          strokeWidth={3}
          class="transition-transform duration-300 group-hover:translate-x-1"
        />
      </a>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: black;
    overflow: hidden;
  }

  .starfield {
    background-image:
      radial-gradient(1px 1px at 20px 30px, #fff, rgba(0, 0, 0, 0)),
      radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0, 0, 0, 0)),
      radial-gradient(1px 1px at 50px 160px, #fff, rgba(0, 0, 0, 0)),
      radial-gradient(1.5px 1.5px at 90px 40px, #fff, rgba(0, 0, 0, 0)),
      radial-gradient(1px 1px at 130px 80px, #fff, rgba(0, 0, 0, 0)),
      radial-gradient(1.5px 1.5px at 160px 120px, #fff, rgba(0, 0, 0, 0));
    background-repeat: repeat;
    background-size: 200px 200px;
    animation: stars-move 100s linear infinite;
    opacity: 0.8;
  }

  .starfield-fast {
    background-image:
      radial-gradient(1px 1px at 10px 10px, #fff, rgba(0, 0, 0, 0)),
      radial-gradient(1.5px 1.5px at 150px 150px, #fff, rgba(0, 0, 0, 0));
    background-repeat: repeat;
    background-size: 300px 300px;
    animation: stars-move 40s linear infinite;
    opacity: 0.4;
  }

  @keyframes stars-move {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-1000px);
    }
  }
</style>
