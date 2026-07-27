<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchJournalEntries, updateJournalEntry } from "$api/controllers/journal-controller";
  import type { JournalRecord } from "$lib/types";
  import TransactionForm from "$components/TransactionForm.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";

  const id = $derived(page.params.id);

  let initialData = $state<JournalRecord | null>(null);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  async function loadTransaction() {
    isLoading = true;
    error = null;

    try {
      const entries = await fetchJournalEntries();
      const list = Array.isArray(entries) ? entries : entries.items;
      const txn = list.find((row) => row.id === id);
      if (!txn) {
        error = "Transaction not found.";
        return;
      }

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
    if (!initialData || !id) return;
    isSubmitting = true;
    try {
      await updateJournalEntry(id, {
        date: row[0],
        creator: row[1],
        account: row[2],
        water: parseFloat(row[3] || "0"),
        assoc: parseFloat(row[4] || "0"),
        misc: parseFloat(row[5] || "0"),
        mop: row[6],
        period: row[7],
        type: row[8],
        notes: row[9],
        notesPrivate: row[10],
        mopRefNo: row[11],
        prDateIssued: row[12],
        prRefNo: row[13],
        creatorName: row[14],
        name: row[15],
        stno: row[16],
        receiptUrl: row[18]
      });
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
  <LoadingView />
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
