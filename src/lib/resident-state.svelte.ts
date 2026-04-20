import { auth } from "./auth.svelte";
import { fetchServer } from "./utils";

class ResidentState {
  status = $state<any>(null);
  isLoading = $state(false);
  error = $state<string | null>(null);

  async refresh() {
    if (!auth.accessToken) return;
    this.isLoading = true;
    try {
      this.status = await fetchServer("/api/resident/check-status");
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.isLoading = false;
    }
  }

  get needsOnboarding() {
    return (
      this.status &&
      (!this.status.isRegistered || !this.status.hasActiveAccount || !this.status.account?.bed)
    );
  }
}

export const residentState = new ResidentState();
