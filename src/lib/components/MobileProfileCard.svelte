<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { auth } from "$lib/state/auth.svelte";
  import { CircleUser, LogOut } from "@lucide/svelte";

  const sidebar = Sidebar.useSidebar();
  let imgError = $state(false);
</script>

{#if sidebar.isMobile && auth.user}
  <div class="flex flex-col px-4 pt-6 gap-6">
    <div class="flex flex-col items-center justify-center text-center gap-3">
      {#if !imgError}
        <img
          src={auth.cachedPicture || auth.user.picture}
          alt={auth.user.name}
          class="h-32 w-32 rounded-full object-cover"
          onerror={() => (imgError = true)}
        />
      {:else}
        <CircleUser class="h-32 w-32 text-foreground" />
      {/if}

      <h2 class="text-2xl font-normal tracking-normal mt-1 text-foreground">
        Hi, {auth.user.given_name || auth.user.name.split(" ")[0]}!
      </h2>

      <button
        onclick={() => auth.logout()}
        class="mt-1 px-6 py-2 rounded-full border border-border text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 text-foreground"
      >
        <LogOut class="h-4 w-4" />
        <span>Sign out</span>
      </button>
    </div>
  </div>
{/if}
