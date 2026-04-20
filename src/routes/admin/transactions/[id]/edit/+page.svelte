<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { uiSettings } from "$lib/settings.svelte";
  import { fetchSheetRowsRaw, updateSheetValue } from "$lib/google-sheets";
  import { JOURNAL_COL as JOR } from "$lib/schemas";
  import { mapRowToJournal } from "$lib/resident-logic";
  import type { JournalRecord } from "$lib/schemas";
  import TransactionForm from "$lib/components/TransactionForm.svelte";
  import LoadingView from "$lib/components/LoadingView.svelte";
  import ErrorView from "$lib/components/ErrorView.svelte";

  const id = $derived(page.params.id);

  let initialData = $state<JournalRecord | null>(null);
  let rowIndex = $state<number | null>(null);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  async function loadTransaction() {
    if (!uiSettings.accountingWorkbookId) return;
    isLoading = true;
    error = null;

    try {
      const journalRows = await fetchSheetRowsRaw(
        uiSettings.accountingWorkbookId,
        "journal_general!A:W"
      );
      const idx = journalRows.findIndex((row) => row[JOR.ID] === id);
      if (idx === -1) {
        error = "Transaction not found.";
        return;
      }
      rowIndex = idx;
      const txn = mapRowToJournal(journalRows[idx]);

      if (txn.wasAudited) {
        error = "This transaction has been audited and cannot be edited.";
        return;
      }

      initialData = txn;
    } catch (e: any) {
      error = `Failed to load transaction: ${e.message}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(loadTransaction);

  async function handleSave(row: any[]) {
    if (rowIndex === null) return;
    isSubmitting = true;
    try {
      // Range is 1-indexed. rowIndex 0 is header. data starts at rowIndex 1 -> Row 2.
      const sheetRow = rowIndex + 1;
      const range = `journal_general!A${sheetRow}:W${sheetRow}`;

      await updateSheetValue(uiSettings.accountingWorkbookId, range, [row]);
      goto(`/admin/transactions/${id}`);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto(`/admin/transactions/${id}`);
  }
</script>

{#if isLoading}
  <LoadingView text="Loading transaction details…" />
{:else if error}
  <ErrorView {error} />
{:else}
  <TransactionForm
    mode="edit"
    {initialData}
    {isSubmitting}
    onSave={handleSave}
    onCancel={handleCancel}
  />
{/if}
