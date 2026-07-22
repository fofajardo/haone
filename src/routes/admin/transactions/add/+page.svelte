<script lang="ts">
  import { goto } from "$app/navigation";
  import { uiSettings } from "$lib/state/settings.svelte";
  import { appendSheetRow } from "$lib/services/google-sheets-service";
  import TransactionForm from "$lib/components/TransactionForm.svelte";

  let isSubmitting = $state(false);

  async function handleSave(row: any[] | any[][]) {
    isSubmitting = true;
    try {
      const rows = Array.isArray(row[0]) ? (row as any[][]) : [row as any[]];
      await appendSheetRow(uiSettings.accountingWorkbookId, "journal_general!A:T", rows);
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
