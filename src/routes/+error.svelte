<script lang="ts">
  import { page } from "$app/state";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import {
    ChevronRight,
    RefreshCcw,
    House,
    MapPinOff,
    Lock,
    ShieldAlert,
    Zap,
    CircleAlert,
    Construction
  } from "lucide-svelte";
  import { fade, slide } from "svelte/transition";
  import { cn } from "$lib/utils";
  import { toast } from "svelte-sonner";

  let showDetails = $state(false);

  const status = page.status;
  const error = page.error as { message: string; stack?: string };

  const errorTitles: Record<number, string> = {
    404: "These aren't the droids you're looking for",
    401: "Stay on target… (Auth Denied)",
    403: "You lack the Force (Access Forbidden)",
    500: "A great disturbance in the Force",
    503: "The hyperdrive is leaking"
  };

  const errorIcons: Record<number, any> = {
    404: MapPinOff,
    401: Lock,
    403: ShieldAlert,
    500: Zap,
    503: Construction
  };

  const errorDescriptions: Record<number, string> = {
    404: "The coordinates you provided lead to a void in space-time. Perhaps the archives are incomplete?",
    401: "Your clearance codes have expired or are invalid. Please re-authenticate.",
    403: "This sector is restricted. You do not have the required clearance level.",
    500: "A critical failure has occurred in the reactor core. Our droids are working on it.",
    503: "The system is currently undergoing tactical maintenance. Check back soon."
  };

  const title = errorTitles[status] || `Something went wrong (${status || 500})`;
  const Icon = errorIcons[status] || CircleAlert;
  const description =
    errorDescriptions[status] || error?.message || "Internal server error occurred.";

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
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50"
        >
          <Icon class="h-6 w-6" />
        </div>
        <Card.Title class="text-2xl font-bold">{title}</Card.Title>
        <Card.Description class="text-sm leading-relaxed text-balance">
          {description}
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
