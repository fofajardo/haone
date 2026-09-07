<script lang="ts">
  import AppShell from "$components/nav/AppShell.svelte";
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { globalDialog } from "$state/dialog.svelte";

  let { children } = $props();
  let isLoadingAuth = $state(true);

  const isLoading = $derived(
    isLoadingAuth ||
      (!auth.accessToken && page.url.pathname !== "/sign-in") ||
      auth.authType !== "admin"
  );

  onMount(async () => {
    isLoadingAuth = false;
    if (auth.accessToken && auth.user?.email && !auth.adminDisplayName) {
      try {
        const { fetchUsers } = await import("$api/controllers/resident-controller");
        const users = await fetchUsers();
        const found = users.find((u) => {
          return u.email.toLowerCase() === auth.user!.email.toLowerCase();
        });
        if (found && found.displayName) {
          auth.setAdminDisplayName(found.displayName);
        }
      } catch (err) {
        console.error("Failed to fetch admin display name:", err);
      }
    }
  });

  // Redirect logic
  $effect(() => {
    if (auth.accessToken) {
      if (auth.authType !== "admin") {
        if (auth.isInstanceAdmin) {
          auth.logout();
          auth.redirectTo = page.url.pathname + page.url.search;
          globalDialog.show(
            "Access Denied",
            "Instance administrator accounts must sign in as a House Council Officer."
          );
          goto("/sign-in");
          return;
        }
        goto("/resident");
      }
      return;
    }

    // Save path for restoration
    auth.redirectTo = page.url.pathname + page.url.search;
    goto("/sign-in");
  });
</script>

<AppShell {isLoading}>
  {@render children()}
</AppShell>
