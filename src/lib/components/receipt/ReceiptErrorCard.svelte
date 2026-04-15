<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { CircleAlert } from "lucide-svelte";

  let { error, onRetry } = $props<{
    error: string;
    onRetry: () => void;
  }>();
</script>

<Card.Root class="w-full max-w-sm shadow-none ring-0 sm:shadow-sm sm:ring-1 sm:ring-destructive/50">
  <Card.Header class="text-center">
    <CircleAlert class="mx-auto mb-3 h-10 w-10 text-destructive" />
    <Card.Title class="text-destructive">Error</Card.Title>
    <Card.Description>{error}</Card.Description>
  </Card.Header>
  <Card.Footer>
    <Button onclick={onRetry} variant="outline" class="w-full">Retry</Button>
  </Card.Footer>
</Card.Root>
