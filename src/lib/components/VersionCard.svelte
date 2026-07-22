<script lang="ts">
  import * as Card from "$ui/card";
</script>

<Card.Root class="overflow-hidden">
  <Card.Content>
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

        <p>HAOne is a comprehensive administrative suite for UPLB Residence Hall Associations.</p>
        <p class="text-xs">
          By using this platform, you agree to our <a
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
  </Card.Content>
</Card.Root>
