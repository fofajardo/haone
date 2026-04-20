<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { CircleCheckBig } from "lucide-svelte";
</script>

<Card.Root class="overflow-hidden">
  <Card.Content class="pt-6">
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-2.5">
        <img src="/ha1.svg" alt="HAOne" class="h-10 w-10" />
        <span class="text-3xl font-bold tracking-tighter text-foreground">HAOne</span>
      </div>

      <div class="space-y-4">
        <div
          class="flex flex-col items-start gap-4 text-xs font-semibold text-foreground sm:flex-row sm:items-center sm:gap-x-8 sm:gap-y-2"
        >
          <div class="flex items-center gap-2">
            <span class="tracking-widest uppercase">Version</span>
            <code class="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
              >v{__APP_VERSION__}</code
            >
          </div>
          <div class="flex items-center gap-2 sm:border-l sm:border-border/50 sm:pl-8">
            <span class="tracking-widest uppercase">Build</span>
            <code class="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
              >{__COMMIT_SHA__}</code
            >
          </div>
          <div class="flex items-center gap-2 sm:border-l sm:border-border/50 sm:pl-8">
            <span class="tracking-widest uppercase">License</span>
            <code class="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
              >MPL-2.0</code
            >
          </div>
        </div>
      </div>
    </div>
  </Card.Content>
</Card.Root>

<div class="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground/60">
  <CircleCheckBig class="h-3.5 w-3.5 text-green-600/50" />
  Settings persist in this browser.
</div>
