<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Trash2, Ellipsis, FilePen } from "@lucide/svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import type { OfficerRecord } from "$lib/schemas";
  import { deleteOfficer } from "$lib/logic/admin-logic";
  import { toast } from "svelte-sonner";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { goto } from "$app/navigation";

  let { officer, onSuccess }: { officer: OfficerRecord; onSuccess?: () => void } = $props();
  let isActionRunning = $state(false);
  let showDeleteDialog = $state(false);

  async function handleDelete() {
    isActionRunning = true;
    try {
      await deleteOfficer(officer.id);
      toast.success("Officer removed");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      isActionRunning = false;
      showDeleteDialog = false;
    }
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon">
        <Ellipsis class="h-4 w-4" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Item onSelect={() => goto(`/admin/officers/${officer.id}`)}>
      <FilePen class="mr-2 h-4 w-4" />
      Edit Record
    </DropdownMenu.Item>
    <DropdownMenu.Item
      class="text-destructive focus:text-destructive"
      onSelect={() => (showDeleteDialog = true)}
    >
      <Trash2 class="mr-2 h-4 w-4" />
      Remove Permanently
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<AlertDialog.Root bind:open={showDeleteDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Permanent Removal</AlertDialog.Title>
      <AlertDialog.Description>
        This will permanently delete {officer.name}'s record from the officers directory. This
        action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={handleDelete}
        disabled={isActionRunning}
        class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
      >
        {isActionRunning ? "Removing…" : "Remove Permanently"}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
