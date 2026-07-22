import { fetchUserSettings } from "$logic/shared-records-logic";

class NavState {
  residentNavIds = $state<string[]>(["home", "finance", "laundry"]);
  adminNavIds = $state<string[]>(["dashboard", "history", "residents"]);
  initialized = $state(false);

  async refresh() {
    try {
      const allSettings = await fetchUserSettings(true);
      const my = allSettings[0];
      if (my?.residentNav) this.residentNavIds = my.residentNav.split(",").filter(Boolean);
      if (my?.adminNav) this.adminNavIds = my.adminNav.split(",").filter(Boolean);
      this.initialized = true;
    } catch (e) {
      console.error("Failed to refresh nav state:", e);
    }
  }
}

export const navState = new NavState();
