<script lang="ts">
  import { onMount } from "svelte";
  import { uiSettings } from "$state/settings.svelte";
  import { fetchTermCurr } from "$api/controllers/constants-controller";
  import {
    getSyncPreview,
    applySync,
    type SyncPreviewAction
  } from "$api/controllers/rooms-controller.svelte";
  import { pluralize } from "$utils/formatters";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import AdminResidentsHeaderActions from "$components/residents/AdminResidentsHeaderActions.svelte";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Checkbox } from "$ui/checkbox";
  import * as AlertDialog from "$ui/alert-dialog";
  import { RefreshCcw, CircleCheck, CircleAlert, MoveRight, CheckCheck } from "@lucide/svelte";

  let isLoading = $state(false);
  let isSyncing = $state(false);
  let error = $state<string | null>(null);
  let activeTerm = $state("");
  let previewActions = $state<SyncPreviewAction[]>([]);
  let selectedGroups = $state<Set<number>>(new Set());

  let alertDialog = $state({
    open: false,
    title: "",
    description: "",
    type: "info" as "info" | "error"
  });

  function showAlert(title: string, description: string, type: "info" | "error" = "info") {
    alertDialog = { open: true, title, description, type };
  }

  const groupedPreview = $derived.by(() => {
    const groups = new Map<number, SyncPreviewAction[]>();
    for (const action of previewActions) {
      const key = action.currIndex ?? -1;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(action);
    }
    return Array.from(groups.entries()).map(([currIndex, actions]) => ({
      currIndex,
      actions
    }));
  });

  const selectedActions = $derived.by(() => {
    const actions: SyncPreviewAction[] = [];
    for (const group of groupedPreview) {
      if (selectedGroups.has(group.currIndex)) {
        actions.push(...group.actions);
      }
    }
    return actions;
  });

  async function loadPreview() {
    isLoading = true;
    error = null;
    try {
      activeTerm = (await fetchTermCurr()) || uiSettings.currentTerm;
      if (!activeTerm) {
        error = "Active academic term (TERM_CURR) not found.";
        return;
      }
      previewActions = await getSyncPreview(activeTerm);
      selectedGroups = new Set(previewActions.map((a) => a.currIndex ?? -1));
    } catch (e: any) {
      error = e.message || "Failed to load sync preview.";
    } finally {
      isLoading = false;
    }
  }

  async function handleApplySync() {
    if (selectedActions.length === 0) {
      showAlert("No Selection", "Please select at least one item to sync.", "error");
      return;
    }
    isSyncing = true;
    try {
      const result = await applySync(selectedActions, activeTerm);
      showAlert(
        "Sync Complete",
        `${pluralize(result.usersCreated, "user profile", "user profiles")} and ${pluralize(result.accountsCreated, "assignment", "assignments")} created. ${pluralize(result.usersUpdated, "user profile", "user profiles")} and ${pluralize(result.accountsUpdated, "assignment", "assignments")} updated. Evaluated ${pluralize(result.evaluated || 0, "registration", "registrations")}.`
      );
      await loadPreview();
    } catch (e: any) {
      showAlert("Sync Failed", e.message || "An error occurred.", "error");
    } finally {
      isSyncing = false;
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      selectedGroups = new Set(groupedPreview.map((g) => g.currIndex));
    } else {
      selectedGroups = new Set();
    }
  }

  onMount(() => {
    loadPreview();
  });
</script>

<div class="space-y-6">
  <SubpageHeader
    title="Residents"
    isTopLevel={true}
    onRefresh={() => loadPreview()}
    isRefreshing={isLoading}
  >
    {#snippet actions()}
      <AdminResidentsHeaderActions active="sync" />
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadPreview()} class="mt-4" {isLoading} icon={RefreshCcw}>
        Retry
      </Button>
    </ErrorView>
  {:else if groupedPreview.length === 0}
    <EmptyView
      title="All records are up to date."
      description="No pending changes between registrations and resident records."
    >
      {#snippet icon()}
        <CircleCheck class="h-8 w-8 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    <div class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <Checkbox
            id="select-all-sync"
            checked={selectedGroups.size === groupedPreview.length}
            indeterminate={selectedGroups.size > 0 && selectedGroups.size < groupedPreview.length}
            onCheckedChange={(v) => toggleAll(!!v)}
          />
          <label for="select-all-sync" class="cursor-pointer text-sm font-medium text-foreground">
            Select All ({selectedGroups.size} of {groupedPreview.length} items)
          </label>
        </div>

        <Button
          onclick={handleApplySync}
          isLoading={isSyncing}
          disabled={selectedGroups.size === 0}
          icon={CheckCheck}
        >
          Apply Sync ({selectedGroups.size})
        </Button>
      </div>

      <div class="space-y-3">
        {#each groupedPreview as group}
          {@const isChecked = selectedGroups.has(group.currIndex)}
          {@const primaryAction = group.actions[0]}
          <div
            class="rounded-xl border transition-colors {isChecked
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-muted/20 opacity-60'}"
          >
            <div class="flex items-start gap-3 p-4">
              <Checkbox
                id={`group-${group.currIndex}`}
                checked={isChecked}
                onCheckedChange={(v) => {
                  const next = new Set(selectedGroups);
                  if (v) {
                    next.add(group.currIndex);
                  } else {
                    next.delete(group.currIndex);
                  }
                  selectedGroups = next;
                }}
                class="mt-0.5"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-bold text-foreground">{primaryAction.residentName}</p>
                  <p class="text-xs text-muted-foreground">
                    {primaryAction.studentNo || primaryAction.email}
                  </p>
                </div>
                <div class="mt-2 space-y-1.5">
                  {#each group.actions as action}
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant={action.type.startsWith("CREATE") ? "default" : "outline"}
                        class="shrink-0 text-xs font-bold tracking-tighter uppercase"
                      >
                        {action.type.replace("_", " ")}
                      </Badge>
                      <span class="text-muted-foreground">{action.details}</span>
                      {#if action.from}
                        <Badge variant="secondary" class="bg-muted text-xs font-bold">
                          {action.from}
                        </Badge>
                      {/if}
                      {#if action.from && action.to}
                        <MoveRight class="h-3 w-3 text-muted-foreground" />
                      {/if}
                      {#if action.to}
                        <Badge
                          variant="secondary"
                          class="bg-primary/10 text-xs font-bold text-primary"
                        >
                          {action.to}
                        </Badge>
                      {/if}
                    </div>
                    {#if action.warning}
                      <p
                        class="flex items-center gap-1 text-xs font-bold text-destructive uppercase"
                      >
                        <CircleAlert class="h-3 w-3" />
                        {action.warning}
                      </p>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<AlertDialog.Root open={alertDialog.open} onOpenChange={(v) => (alertDialog.open = v)}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class={alertDialog.type === "error" ? "text-destructive" : ""}>
        {alertDialog.title}
      </AlertDialog.Title>
      <AlertDialog.Description>{alertDialog.description}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertDialog.open = false)}>OK</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
