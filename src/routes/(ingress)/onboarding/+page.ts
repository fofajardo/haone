import { auth } from "$state/auth.svelte";
import { residentState } from "$state/resident-state.svelte";
import { error, redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = async () => {
  if (!auth.accessToken) {
    redirect(307, "/sign-in");
  }

  if (!residentState.status) {
    await residentState.refresh();
  }

  if (residentState.error) {
    error(500, residentState.error);
  }

  if (!residentState.needsOnboarding && !residentState.forceOnboarding) {
    redirect(307, "/resident");
  }

  const canOnboard = Boolean(
    residentState.status?.hasAcademicTerms && (residentState.status?.systemActiveTerm || "").trim()
  );

  if (!canOnboard) {
    error(
      503,
      "Resident onboarding is currently unavailable because no active academic term is configured."
    );
  }
};
