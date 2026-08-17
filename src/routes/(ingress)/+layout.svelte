<script lang="ts">
  let { children } = $props();
  import HeroVisual from "$components/HeroVisual.svelte";
  import { Button } from "$ui/button";
  import * as DropdownMenu from "$ui/dropdown-menu";
  import { FileText, ShieldCheck, EllipsisVerticalIcon } from "@lucide/svelte";

  const LEGAL_LINKS = [
    { label: "Terms of Service", shortLabel: "Terms", href: "/terms", icon: FileText },
    { label: "Privacy Policy", shortLabel: "Privacy", href: "/privacy", icon: ShieldCheck }
  ];
</script>

<div class="relative flex min-h-screen flex-col bg-background md:flex-row">
  <!-- Panel: Hero -->
  <div
    class="relative flex flex-col justify-between overflow-hidden border-r border-white/5 bg-zinc-950 p-4 text-white md:order-1 md:p-10 lg:w-1/2"
  >
    <div class="relative z-20 flex items-center justify-between">
      <div class="flex items-center text-xl font-bold tracking-tight">
        <img src="/ha1_bw.svg" alt="HAOne" class="mr-3 h-8 w-8" />
        HAOne
        <div
          class="ml-2 inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
        >
          Beta
        </div>
      </div>

      <!-- Desktop Links -->
      <div class="hidden items-center gap-1 md:flex">
        {#each LEGAL_LINKS as link}
          <Button
            variant="ghost"
            size="sm"
            href={link.href}
            class="h-8 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            icon={link.icon}
          >
            {link.shortLabel}
          </Button>
        {/each}
      </div>

      <!-- Mobile Dropdown Menu -->
      <div class="md:hidden">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
                {...props}
              >
                <EllipsisVerticalIcon class="h-4 w-4" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-44">
            {#each LEGAL_LINKS as link}
              <DropdownMenu.Item>
                {#snippet child({ props })}
                  {@const Icon = link.icon}
                  <a href={link.href} class="flex w-full items-center gap-2" {...props}>
                    <Icon class="h-4 w-4" />
                    <span>{link.label}</span>
                  </a>
                {/snippet}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>
    <div class="mesh-gradient"></div>
    <div class="h-max-content w-max-content hidden md:block">
      <HeroVisual />
    </div>
    <div class="vignette"></div>
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
