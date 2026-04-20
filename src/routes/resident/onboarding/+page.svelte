<script lang="ts">
  import OnboardingForm from "$lib/components/resident/OnboardingForm.svelte";
  import { residentState } from "$lib/resident-state.svelte";
  import * as Card from "$lib/components/ui/card";
  import { User, LogOut, Clock, RefreshCcw, LoaderCircle } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { auth } from "$lib/auth.svelte";
  import { pageState } from "$lib/page-info.svelte";
  import { onMount } from "svelte";

  import { brandingState } from "$lib/branding.svelte";
  import { translatePeriod } from "$lib/receipt-utils";

  import { goto } from "$app/navigation";

  onMount(() => {
    pageState.title = "Onboarding";
  });

  async function handleSuccess() {
    await residentState.refresh();
    if (!residentState.needsOnboarding) {
      goto("/resident");
    }
  }
</script>

<div class="mx-auto max-w-2xl py-6">
  <div class="mb-8 flex items-center">
    <div class="flex items-center gap-3">
      <div class="rounded-2xl bg-brand/10 p-3 text-brand">
        {#if residentState.status?.waitingForConfirmation}
          <Clock class="h-6 w-6" />
        {:else}
          <User class="h-6 w-6" />
        {/if}
      </div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          {residentState.status?.waitingForConfirmation
            ? "Registration Received"
            : "Welcome to HAOne"}
        </h1>
      </div>
    </div>
  </div>

  {#if residentState.status?.waitingForConfirmation}
    <Card.Root class="border-brand/20 bg-card shadow-xl">
      <Card.Header>
        <Card.Title>Account Confirmation Pending</Card.Title>
        <Card.Description>
          We've received your registration for <strong
            >{translatePeriod(residentState.status?.activeTerm) || "the current term"}</strong
          >.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <p class="text-sm text-muted-foreground">
          An administrator is currently reviewing your assignment. This usually takes less than 24
          hours. You'll be able to access the dashboard once your record is evaluated.
        </p>
        <div class="flex justify-center pt-4">
          <Button onclick={() => residentState.refresh()} disabled={residentState.isLoading}>
            {#if residentState.isLoading}
              <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
              Checking…
            {:else}
              <RefreshCcw class="mr-2 h-4 w-4" />
              Check Status
            {/if}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root class="border-brand/20 bg-card shadow-xl">
      <Card.Header>
        <Card.Title>Onboarding</Card.Title>
        <Card.Description>
          We couldn't find an active record for <strong
            >{translatePeriod(residentState.status?.activeTerm) || "the current term"}</strong
          > associated with your account.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <OnboardingForm status={residentState.status} onSuccess={handleSuccess} />
      </Card.Content>
    </Card.Root>
  {/if}

  <div class="mt-8 text-center">
    <p class="text-sm text-muted-foreground">
      If you believe this is an error, please contact the administrator of this instance via <a
        href="mailto:{brandingState.profile.replyTo}"
        class="font-bold text-brand hover:underline"
      >
        email
      </a>.
    </p>
  </div>
</div>
