<script lang="ts">
  import { brandingState } from "$lib/branding.svelte";
  import { uiSettings } from "$lib/settings.svelte";
</script>

<div class="hidden w-full space-y-4 lg:block lg:w-[400px]">
  <div class="sticky top-8 space-y-4">
    <div
      class="rounded-2xl border bg-card p-8 shadow-sm transition-all {uiSettings.displayDensity !==
      'default'
        ? `acc-density-${uiSettings.displayDensity}`
        : ''}"
      data-slot="sandbox"
      class:font-sans={uiSettings.fontFamily === "inter"}
      class:font-archivo={uiSettings.fontFamily === "archivo"}
      class:font-shantell={uiSettings.fontFamily === "shantell"}
      class:acc-reduced-motion={uiSettings.reducedMotion}
    >
      <div class="flex flex-col items-center gap-6 text-center">
        <img src={brandingState.profile.logoUrl} alt="Logo" class="h-16 w-auto grayscale-0" />
        <div class="w-full space-y-4">
          <div class="space-y-1">
            <h3 class="text-lg font-bold text-foreground">
              {brandingState.profile.issuerName}
            </h3>
            <p class="text-xs text-muted-foreground">Electronic Receipt Preview</p>
          </div>

          <div class="h-px w-full bg-border"></div>

          <div class="space-y-2 text-left">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Water Fee</span>
              <span class="font-bold">2,500.00</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Association Fee</span>
              <span class="font-bold">1,200.00</span>
            </div>
            <div class="flex justify-between border-t pt-2 font-bold">
              <span>TOTAL</span>
              <span>₱3,700.00</span>
            </div>
          </div>

          <div class="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground italic">
            This is a reactive preview showing current branding, typography, and density settings.
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
