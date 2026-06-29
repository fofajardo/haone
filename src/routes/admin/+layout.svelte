<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import AdminSidebar from "$lib/components/admin-sidebar.svelte";
  import AdminHeader from "$lib/components/admin-header.svelte";
  import MobileNav from "$lib/components/mobile-nav.svelte";
  import { auth } from "$lib/auth.svelte";
  import { onMount } from "svelte";
  import { LoaderCircle } from "@lucide/svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";

  let { children } = $props();
  let isLoadingAuth = $state(true);
  let alertState = $state({ open: false, title: "", description: "" });

  function showError(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    isLoadingAuth = false;
    if (auth.accessToken && auth.user?.email && !auth.adminDisplayName) {
      try {
        const { fetchUsers } = await import("$lib/resident-logic");
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

  // Handle errors from anywhere (e.g., session expired)
  $effect(() => {
    if (auth.lastError) {
      // If we're about to redirect to sign-in due to auth error,
      // don't clear it here; let sign-in page handle it.
      if (!auth.accessToken) return;

      showError(auth.lastError.title, auth.lastError.description);
      auth.lastError = null;
    }
  });

  // Redirect logic
  $effect(() => {
    const isSignInPage = page.url.pathname === "/sign-in";

    if (!auth.accessToken && !isSignInPage) {
      // Save path for restoration
      auth.redirectTo = page.url.pathname + page.url.search;
      goto("/sign-in");
    }
  });
</script>

{#if isLoadingAuth || (!auth.accessToken && page.url.pathname !== "/sign-in")}
  <div class="flex min-h-screen items-center justify-center">
    <LoaderCircle class="h-8 w-8 animate-spin text-foreground" />
  </div>
{:else}
  <Sidebar.Provider>
    <AdminSidebar />
    <Sidebar.Inset>
      <AdminHeader />
      <main class="flex-1 overflow-auto p-4 pb-24 md:p-8 md:pb-8">
        {@render children()}
      </main>
      <MobileNav />
    </Sidebar.Inset>
  </Sidebar.Provider>
{/if}

<!-- Global Error Alert -->
<AlertDialog.Root bind:open={alertState.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{alertState.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {@html alertState.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertState.open = false)}>Close</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
