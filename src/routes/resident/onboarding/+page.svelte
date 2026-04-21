<script lang="ts">
  import OnboardingForm from "$lib/components/resident/OnboardingForm.svelte";
  import { residentState } from "$lib/resident-state.svelte";
  import * as Card from "$lib/components/ui/card";
  import { User, Clock, RefreshCcw, LoaderCircle } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { pageState } from "$lib/page-info.svelte";

  import { brandingState } from "$lib/branding.svelte";
  import { translatePeriod } from "$lib/receipt-utils";

  import { goto } from "$app/navigation";

  $effect(() => {
    pageState.title = residentState.status?.waitingForConfirmation
      ? "Registration Pending"
      : "Onboarding";
  });

  async function handleSuccess() {
    await residentState.refresh();
    if (residentState.error) {
      throw new Error(residentState.error);
    }
    if (!residentState.needsOnboarding) {
      goto("/resident");
    }
  }
</script>

<div class="mx-auto max-w-2xl">
  <div class="px-4 py-8 sm:px-0">
    <OnboardingForm status={residentState.status} onSuccess={handleSuccess} />
  </div>

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
