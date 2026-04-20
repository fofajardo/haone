<script lang="ts">
  import { goto } from "$app/navigation";
  import { uiSettings } from "$lib/settings.svelte";
  import { appendSheetRow } from "$lib/google-sheets";
  import TransactionForm from "$lib/components/TransactionForm.svelte";

  let isSubmitting = $state(false);

  async function handleSave(row: any[]) {
    isSubmitting = true;
    try {
      await appendSheetRow(uiSettings.accountingWorkbookId, "journal_general!A:T", [row]);
      goto("/admin/transactions");
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/admin/transactions");
  }
</script>

<TransactionForm mode="add" {isSubmitting} onSave={handleSave} onCancel={handleCancel} />
