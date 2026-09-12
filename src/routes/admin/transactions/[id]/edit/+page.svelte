<script lang="ts">
  import { pageState } from "$state/page-info.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { fetchJournalEntries, updateJournalEntry } from "$api/controllers/journal-controller";
  import { type JournalRecord, JOURNAL_COL as JOR } from "$lib/types";
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

  async function handleSave(row: any[]) {
    if (!initialData || !id) {
      return;
    }
    isSubmitting = true;
    try {
      await updateJournalEntry(id, {
        date: row[JOR.DATE],
        creator: row[JOR.CREATOR] || "",
        account: row[JOR.ACCOUNT] || "",
        water: parseFloat(row[JOR.WATER] || "0"),
        assoc: parseFloat(row[JOR.ASSOC] || "0"),
        misc: parseFloat(row[JOR.MISC] || "0"),
        mop: row[JOR.MOP],
        period: row[JOR.PERIOD],
        type: row[JOR.TYPE],
        notes: row[JOR.NOTES],
        notesPrivate: row[JOR.NOTES_PRIVATE],
        mopRefNo: row[JOR.MOP_REFNO],
        prDateIssued: row[JOR.PR_DATE_ISSUED],
        prRefNo: row[JOR.PR_REFNO],
        creatorName: row[JOR.CREATOR_NAME] || "",
        name: row[JOR.NAME] || "",
        stno: row[JOR.STNO] || "",
        receiptUrl: row[JOR.RECEIPT_URL],
        creatorId: row[JOR.CREATOR_ID] || "",
        accountId: row[JOR.ACCOUNT_ID] || ""
      });
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
