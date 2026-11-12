<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { fetchJournalEntries, updateJournalEntry } from "$api/controllers/journal-controller";
  import { type JournalRecord } from "$lib/types";
  import TransactionForm from "$components/forms/TransactionForm.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";

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

  onMount(() => {
    pageState.title = "Edit Transaction";
    loadTransaction();
  });

  async function handleSave(entry: Partial<JournalRecord> | Partial<JournalRecord>[]) {
    if (!initialData || !id) {
      return;
    }
    isSubmitting = true;
    try {
      const target = Array.isArray(entry) ? entry[0] : entry;
      await updateJournalEntry(id, target);
      goto(`/admin/transactions/${id}`);
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if isLoading}
  <LoadingView />
{:else if error}
  <ErrorView {error} />
{:else}
  <TransactionForm mode="edit" {initialData} {isSubmitting} onSave={handleSave} />
{/if}
