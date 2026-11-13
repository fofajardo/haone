<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { feeCodesState } from "$state/fee-codes.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import AdminFeesTabs from "$components/tabs/AdminFeesTabs.svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { Button } from "$ui/button";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { Plus, Tags } from "@lucide/svelte";
  import { createColumns } from "./columns";

  const columns = createColumns();

  let isLoading = $state(true);
  let errorMessage = $state("");

  async function loadFeeCodes(force = false) {
    isLoading = true;
    errorMessage = "";
    try {
      await feeCodesState.load(force);
    } catch (err: any) {
      errorMessage = err?.message || "Failed to load fee codes.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => loadFeeCodes(true));
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Fees"
    isTopLevel={true}
    onRefresh={() => loadFeeCodes(true)}
    isRefreshing={isLoading}
    actions={[
      {
        label: "Add",
        icon: Plus,
        onclick: () => goto("/admin/fees/new")
      }
    ]}
  >
    {#snippet tabs()}
      <AdminFeesTabs active="fee-codes" />
    {/snippet}
  </ContentHeader>

  {#if isLoading && feeCodesState.list.length === 0}
    <LoadingView />
  {:else if errorMessage}
    <ErrorView error={errorMessage}>
      <Button variant="outline" size="sm" onclick={() => loadFeeCodes(true)}>Retry</Button>
    </ErrorView>
  {:else if feeCodesState.list.length === 0}
    <EmptyView
      title="No fee codes configured"
      description="Add your first fee code to start categorizing journal entries."
    >
      {#snippet icon()}
        <Tags class="size-8 text-muted-foreground/50" />
      {/snippet}
    </EmptyView>
  {:else}
    <DataTable
      {columns}
      data={feeCodesState.list}
      rowId="id"
      onRowClick={(cfg) => goto(`/admin/fees/${cfg.id}`)}
      sorting={[{ id: "sortOrder", desc: false }]}
    />
  {/if}
</div>
