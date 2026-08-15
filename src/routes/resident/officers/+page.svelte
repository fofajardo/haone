<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw, BookUser, Mail } from "@lucide/svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import EmptyView from "$components/EmptyView.svelte";
  import * as Card from "$ui/card";
  import { fetchOfficers } from "$api/controllers/officer-controller";
  import { Badge } from "$ui/badge";

  import { pageState } from "$state/page-info.svelte";

  let officers = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadData(bypassCache = false) {
    isLoading = true;
    error = null;
    try {
      officers = await fetchOfficers(bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Officers";
    loadData();
  });
</script>

<div class="space-y-3">
  <SubpageHeader title="Officers" isTopLevel={true}>
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        onclick={() => loadData(true)}
        {isLoading}
        icon={RefreshCcw}
      />
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <div>
      <LoadingView />
    </div>
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else if officers.length === 0}
    <EmptyView title="No officers listed." description="The directory is currently empty.">
      {#snippet icon()}
        <BookUser class="h-8 w-8 text-muted-foreground" />
      {/snippet}
    </EmptyView>
  {:else}
    <div class="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each officers as o}
        <Card.Root
          class="flex flex-col border-none bg-card text-center transition-all hover:shadow-md"
        >
          <Card.Header class="pb-2">
            <Card.Title class="text-2xl font-bold">
              {o.name}
            </Card.Title>

            <div class="mt-1 flex flex-col gap-1">
              <span class="text-xs font-bold tracking-widest text-primary uppercase">
                {o.position}
              </span>
              {#if o.nickname}
                <p class="font-serif text-sm font-normal text-muted-foreground italic">
                  {o.nickname}
                </p>
              {/if}
            </div>
          </Card.Header>

          <Card.Content class="mt-auto">
            <div class="flex items-center justify-between border-t pt-4">
              {#if o.room && o.room !== "N/A"}
                <span class="text-xs font-semibold tracking-wider uppercase">
                  Room {o.room}
                </span>
              {/if}
              {#if o.committee && o.committee !== "N/A"}
                <span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {o.committee} Committee
                </span>
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
