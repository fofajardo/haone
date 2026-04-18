<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Lock } from "lucide-svelte";

  let {
    studentNo = $bindable(),
    rememberMe = $bindable(),
    isDecrypting,
    onAuthenticate,
    title = "Authentication Required",
    description = "Please enter your UP Student Number to access this document."
  } = $props<{
    studentNo: string;
    rememberMe: boolean;
    isDecrypting: boolean;
    onAuthenticate: () => void;
    title?: string;
    description?: string;
  }>();
</script>

<Card.Root class="w-full max-w-sm shadow-none ring-0 sm:shadow-sm sm:ring-1">
  <Card.Header class="text-center">
    <div class="mx-auto mb-4 w-fit rounded-full bg-muted p-2.5">
      <Lock class="h-5 w-5 text-muted-foreground" />
    </div>
    <Card.Title>{title}</Card.Title>
    <Card.Description>{description}</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="space-y-2">
      <Label for="stno" class="text-xs tracking-widest text-muted-foreground uppercase"
        >Student Number</Label
      >
      <Input
        id="stno"
        type="text"
        bind:value={studentNo}
        placeholder="e.g., 2021-0001"
        autocomplete="off"
        onkeydown={(e) => e.key === "Enter" && onAuthenticate()}
      />
    </div>
    <div class="flex items-center space-x-2">
      <Checkbox id="remember" bind:checked={rememberMe} />
      <Label
        for="remember"
        class="text-xs leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Remember student ID
      </Label>
    </div>
    <Button onclick={onAuthenticate} class="w-full" disabled={isDecrypting || !studentNo}>
      {isDecrypting ? "Verifying…" : "Unlock"}
    </Button>
  </Card.Content>
</Card.Root>
