<script lang="ts">
  import * as AlertDialog from "$ui/alert-dialog";
  import { globalDialog } from "$state/dialog.svelte";
</script>

<AlertDialog.Root bind:open={globalDialog.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{globalDialog.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {@html globalDialog.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => globalDialog.close()}>Close</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
