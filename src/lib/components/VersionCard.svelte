<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { GitFork, Zap, Bug } from "@lucide/svelte";
</script>

<Card.Root class="overflow-hidden lg:block lg:h-fit lg:w-100">
  <Card.Content>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <img src="/ha1.svg" alt="HAOne" class="h-10 w-10" />
        <span class="text-3xl font-bold tracking-tighter text-foreground">HAOne</span>
      </div>

      <div class="flex flex-col gap-2">
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

      <div class="space-y-4">
        <ul class="space-y-1.5 text-sm">
          <li class="flex items-center gap-2">
            <span class="w-40 font-medium uppercase">Version</span>
            <span class="font-mono">v{__APP_VERSION__}</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="w-40 font-medium uppercase">Commit</span>
            <span class="font-mono">{__COMMIT_SHA__}</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="w-40 font-medium uppercase">Build Timestamp</span>
            <span>{new Date(__BUILD_TIME__).toLocaleString()}</span>
          </li>
        </ul>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            href="https://github.com/fofajardo/haone/issues"
            target="_blank"
            rel="noreferrer noopener"
            variant="secondary"
            size="sm"
          >
            <Bug class="size-4" />
            Report a Bug
          </Button>
          <Button
            href="https://github.com/fofajardo/haone"
            target="_blank"
            rel="noreferrer noopener"
            variant="secondary"
            size="sm"
          >
            <GitFork class="size-4" />
            Fork me on GitHub
          </Button>
          <Button
            href="https://svelte.dev"
            target="_blank"
            rel="noreferrer noopener"
            variant="secondary"
            size="sm"
          >
            <Zap class="size-4" />
            Powered by Svelte
          </Button>
        </div>
      </div>
    </div>
  </Card.Content>
</Card.Root>
