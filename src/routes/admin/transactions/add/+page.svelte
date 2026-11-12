<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import { goto } from "$app/navigation";
  import { addJournalEntries } from "$api/controllers/journal-controller";
  import type { JournalRecord } from "$lib/types";
  import TransactionForm from "$components/forms/TransactionForm.svelte";

  let isSubmitting = $state(false);

  async function handleSave(entry: Partial<JournalRecord> | Partial<JournalRecord>[]) {
    isSubmitting = true;
    try {
      const entries = Array.isArray(entry) ? entry : [entry];
      await addJournalEntries(entries);
      goto("/admin/transactions");
    } finally {
      isSubmitting = false;
    }
  }

  onMount(() => {
    pageState.title = "Add Transaction";
  });
</script>

<TransactionForm mode="add" {isSubmitting} onSave={handleSave} />
