<script lang="ts">
  import * as Sidebar from "$ui/sidebar";
  import { auth } from "$state/auth.svelte";
  import { CircleUser, LogOut } from "@lucide/svelte";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);
</script>

{#if sidebar.isMobile && auth.googleUser}
  <div class="flex flex-col gap-6 px-4 pt-6">
    <div class="flex flex-col items-center justify-center gap-3 text-center">
      {#if !imgError}
        <img
          src={auth.cachedPicture || auth.googleUser.picture}
          alt={auth.googleUser.name}
          class="h-32 w-32 rounded-full object-cover"
          onerror={() => (imgError = true)}
        />
      {:else}
        <CircleUser class="h-32 w-32 text-foreground" />
      {/if}

      <h2 class="mt-1 text-2xl font-normal tracking-normal text-foreground">
        Hi, {auth.googleUser.given_name || auth.googleUser.name.split(" ")[0]}!
      </h2>

      <button
        onclick={() => auth.signOut()}
        class="mt-1 flex items-center gap-2 rounded-full border border-border px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <LogOut class="h-4 w-4" />
        <span>Sign out</span>
      </button>
    </div>
  </div>
{/if}
