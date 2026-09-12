<script lang="ts">
  import { onMount } from "svelte";
  import { dev } from "$app/environment";
  import { error } from "@sveltejs/kit";
  import ContentHeader from "$components/ContentHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import { Button } from "$ui/button";
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$ui/card";
  import { Badge } from "$ui/badge";
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$ui/table";
  import { toast } from "svelte-sonner";
  import {
    fetchDatabaseStatus,
    syncUsers,
    syncAccounts,
    syncJournal,
    syncAnnouncements,
    syncConstants,
    syncLaundry,
    syncPaymentRequests,
    syncAchievements,
    syncAwards,
    syncOfficers,
    type SyncResult
  } from "$api/services/database-sync-service";
  import { Database, RefreshCcw, ArrowRightLeft, CircleCheck, CircleAlert } from "@lucide/svelte";

  if (!dev) {
    throw error(404, "Not Found");
  }

  let loading = $state(true);
  let syncing = $state(false);
  let status = $state<{ entity: string; gsheets: number; supabase: number }[]>([]);
  let lastResults = $state<SyncResult[]>([]);

  async function loadStatus() {
    loading = true;
    try {
      status = await fetchDatabaseStatus();
    } catch (err: any) {
      toast.error("Failed to load database status: " + err.message);
    } finally {
      loading = false;
    }
  }

  onMount(loadStatus);

  const entitySyncFns: Record<string, (dir: "toSupabase" | "toGSheets") => Promise<SyncResult>> = {
    Users: syncUsers,
    Residents: syncAccounts,
    Journal: syncJournal,
    Announcements: syncAnnouncements,
    Constants: syncConstants,
    Laundry: syncLaundry,
    "Payment Requests": syncPaymentRequests,
    Achievements: syncAchievements,
    Awards: syncAwards,
    Officers: syncOfficers
  };

  async function handleSync(entity: string, direction: "toSupabase" | "toGSheets") {
    syncing = true;
    const toastId = toast.loading(
      `Syncing ${entity} ${direction === "toSupabase" ? "to Supabase" : "to GSheets"}…`
    );
    try {
      const fn = entitySyncFns[entity];
      if (!fn) {
        throw new Error("No sync function for " + entity);
      }

      const result = await fn(direction);
      lastResults = [result, ...lastResults.filter((r) => r.entity !== entity)];

      if (result.failed) {
        toast.error(`Sync failed for ${entity}`, { id: toastId });
      } else {
        toast.success(`Synced ${entity}: ${result.added} added, ${result.updated} updated`, {
          id: toastId
        });
        await loadStatus();
      }
    } catch (err: any) {
      toast.error(`Sync error: ${err.message}`, { id: toastId });
    } finally {
      syncing = false;
    }
  }

  async function syncAll(direction: "toSupabase" | "toGSheets") {
    syncing = true;
    const toastId = toast.loading(
      `Syncing all entities ${direction === "toSupabase" ? "to Supabase" : "to GSheets"}…`
    );
    const results: SyncResult[] = [];

    try {
      for (const entity of status.map((s) => s.entity)) {
        const fn = entitySyncFns[entity];
        if (fn) {
          const res = await fn(direction);
          results.push(res);
        }
      }
      lastResults = results;
      toast.success("Bulk sync completed", { id: toastId });
      await loadStatus();
    } catch (err: any) {
      toast.error("Bulk sync interrupted: " + err.message, { id: toastId });
    } finally {
      syncing = false;
    }
  }
</script>

<div class="space-y-3">
  <ContentHeader
    title="Database Sync"
    isTopLevel={true}
    onRefresh={loadStatus}
    isRefreshing={loading}
    actions={[
      {
        label: "Sync All to Supabase",
        variant: "outline",
        onclick: () => syncAll("toSupabase"),
        disabled: syncing,
        icon: ArrowRightLeft
      },
      {
        label: "Sync All to GSheets",
        variant: "outline",
        onclick: () => syncAll("toGSheets"),
        disabled: syncing,
        icon: ArrowRightLeft
      }
    ]}
  />

  {#if loading && status.length === 0}
    <LoadingView />
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card class="lg:col-span-2">
        <CardHeader>
          <CardTitle>Entity Status</CardTitle>
          <CardDescription>Compare record counts across providers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead class="text-center">Google Sheets</TableHead>
                <TableHead class="text-center">Supabase</TableHead>
                <TableHead class="text-center">Status</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each status as item}
                <TableRow>
                  <TableCell class="font-medium">{item.entity}</TableCell>
                  <TableCell class="text-center font-mono">{item.gsheets}</TableCell>
                  <TableCell class="text-center font-mono">{item.supabase}</TableCell>
                  <TableCell class="text-center">
                    {#if item.gsheets === item.supabase}
                      <Badge
                        variant="outline"
                        class="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        <CircleCheck class="mr-1 h-3 w-3" />
                        In Sync
                      </Badge>
                    {:else}
                      <Badge variant="outline" class="border-amber-200 bg-amber-50 text-amber-700">
                        <CircleAlert class="mr-1 h-3 w-3" />
                        Mismatch
                      </Badge>
                    {/if}
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Push to Supabase"
                        onclick={() => handleSync(item.entity, "toSupabase")}
                        disabled={syncing}
                      >
                        <Database class="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Push to Google Sheets"
                        onclick={() => handleSync(item.entity, "toGSheets")}
                        disabled={syncing}
                      >
                        <ArrowRightLeft class="h-4 w-4 text-emerald-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Logs</CardTitle>
            <CardDescription>Results of latest operations.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            {#if lastResults.length === 0}
              <div class="py-8 text-center text-sm text-muted-foreground italic">
                No operations performed in this session.
              </div>
            {:else}
              {#each lastResults as res}
                <div
                  class="flex items-start gap-3 rounded-lg border p-3 text-sm {res.failed
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-border bg-muted/50'}"
                >
                  {#if res.failed}
                    <CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  {:else}
                    <CircleCheck class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {/if}
                  <div class="space-y-1 overflow-hidden">
                    <p class="font-semibold">{res.entity}</p>
                    {#if !res.failed}
                      <p class="text-xs text-muted-foreground">
                        Added: <span class="text-foreground">{res.added}</span>, Updated:
                        <span class="text-foreground">{res.updated}</span>
                      </p>
                    {:else}
                      <p class="truncate text-xs text-destructive" title={res.errors.join(", ")}>
                        {res.errors[0]}
                      </p>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </CardContent>
        </Card>

        <Card class="border-amber-200 bg-amber-50">
          <CardHeader class="pb-2">
            <CardTitle class="flex items-center text-sm text-amber-800">
              <CircleAlert class="mr-2 h-4 w-4" />
              Developer Warning
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-xs text-amber-700">
            <p>
              Syncing is performant but <strong>destructive</strong> in the target database. Values will
              be overwritten if the IDs match.
            </p>
            <p>This module is strictly disabled in production.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  {/if}
</div>
