<script lang="ts">
  import { page } from "$app/state";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { CircleAlert, ChevronRight, RefreshCcw, House } from "lucide-svelte";
  import { fade, slide } from "svelte/transition";
  import { cn } from "$lib/utils";
  import { toast } from "svelte-sonner";

  let showDetails = $state(false);

  const status = page.status;
  const error = page.error as { message: string; stack?: string };

  function reload() {
    window.location.reload();
  }

  function copyToClipboard() {
    const info = `Status: ${status}\nMessage: ${error?.message}\nStack: ${error?.stack}`;
    navigator.clipboard.writeText(info);
    toast.success("Error details copied to clipboard");
  }
</script>

<div
  class="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4 font-sans text-foreground md:p-8"
>
  <div class="w-full max-w-2xl" in:fade={{ duration: 300 }}>
    <Card.Root class="border shadow-none sm:shadow-sm">
      <Card.Header class="text-center">
        <CircleAlert class="mx-auto mb-3 h-10 w-10" />
        <Card.Title class="text-2xl font-bold">Error {status || 500}</Card.Title>
        <Card.Description class="text-sm leading-relaxed text-balance">
          {error?.message || "Something went wrong while processing your request."}
        </Card.Description>
      </Card.Header>

      <Card.Content class="space-y-4">
        {#if error?.stack}
          <div class="space-y-2">
            <button
              onclick={() => (showDetails = !showDetails)}
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              <span class="flex items-center gap-2 tracking-wider uppercase">
                Technical Details
              </span>
              <ChevronRight
                size={14}
                class={cn("transition-transform duration-200", showDetails ? "rotate-90" : "")}
              />
            </button>

            {#if showDetails}
              <div
                transition:slide
                class="overflow-hidden rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"
              >
                <div class="max-h-[200px] overflow-auto font-mono whitespace-pre">
                  {error.stack}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="mt-2 h-7 w-full text-xs tracking-widest uppercase"
                  onclick={copyToClipboard}
                >
                  Copy
                </Button>
              </div>
            {/if}
          </div>
        {/if}
      </Card.Content>

      <Card.Footer class="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onclick={reload} class="w-full font-bold sm:w-32" icon={RefreshCcw}>Retry</Button>
        <Button
          variant="secondary"
          href="/"
          class="w-full text-muted-foreground sm:w-32"
          icon={House}
        >
          Go Home
        </Button>
      </Card.Footer>
    </Card.Root>

    <div class="mt-8 flex flex-col items-center gap-4 text-center opacity-50">
      <div class="h-px w-8 bg-border"></div>
      <div class="flex cursor-default items-center gap-2">
        <span class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
          >Powered by</span
        >
        <div class="flex items-center gap-1.5">
          <img src="/ha1.svg" alt="HAOne" class="h-4 w-4" />
          <span class="text-xs font-black tracking-tighter text-foreground">HAOne</span>
        </div>
      </div>
    </div>
  </div>
</div>
