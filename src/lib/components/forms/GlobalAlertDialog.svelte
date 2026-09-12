<script lang="ts">
  import * as AlertDialog from "$ui/alert-dialog";
  import { globalDialog } from "$state/dialog.svelte";
  import { Button } from "$components/ui/button";
</script>

<AlertDialog.Root
  bind:open={globalDialog.open}
  onOpenChange={(v) => {
    if (!v) {
      globalDialog.handleClose();
    }
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{globalDialog.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {@html globalDialog.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      {#if globalDialog.type === "info"}
        <AlertDialog.Action onclick={() => globalDialog.handleClose()}>
          {globalDialog.labels.close}
        </AlertDialog.Action>
      {:else if globalDialog.type === "confirm"}
        <Button
          onclick={() => globalDialog.handleCancel()}
          disabled={globalDialog.isLoading}
          variant="outline"
        >
          {globalDialog.labels.cancel}
        </Button>
        <Button
          onclick={() => globalDialog.handleAccept()}
          disabled={globalDialog.isLoading}
          isLoading={globalDialog.isLoading}
        >
          {globalDialog.labels.accept}
        </Button>
      {/if}
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
