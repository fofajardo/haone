<script lang="ts">
  import { ResponsiveDialog } from "$ui/haone";
  import { Button } from "$ui/button";
  import { brandingState } from "$state/branding.svelte";

  let isDialogOpen = $state(false);

  export function open() {
    isDialogOpen = true;
  }

  export function close() {
    isDialogOpen = false;
  }
</script>

<ResponsiveDialog.Root bind:open={isDialogOpen}>
  <ResponsiveDialog.Content class="sm:max-w-lg">
    <ResponsiveDialog.Header>
      <ResponsiveDialog.Title>Laundry Rules & Guidelines</ResponsiveDialog.Title>
    </ResponsiveDialog.Header>

    <div class="px-4 md:px-0">
      {#if (brandingState.profile.laundryRules || []).length > 0}
        <ul class="list-inside list-disc space-y-2">
          {#each brandingState.profile.laundryRules || [] as rule}
            <li>{rule}</li>
          {/each}
        </ul>
      {:else}
        <p>Your association has not set any specific laundry rules yet.</p>
      {/if}
    </div>

    <ResponsiveDialog.Footer>
      <ResponsiveDialog.Close>
        <Button class="w-full sm:w-auto">Close</Button>
      </ResponsiveDialog.Close>
    </ResponsiveDialog.Footer>
  </ResponsiveDialog.Content>
</ResponsiveDialog.Root>
