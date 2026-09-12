<script lang="ts">
  import { renderComponent, renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
  import { createRawSnippet } from "svelte";
  import type { OfficerRecord } from "$lib/types";
  import { OfficerStatus } from "$lib/types";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { translatePeriod } from "$utils/translators";
  import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import EmptyView from "$components/content/EmptyView.svelte";
  import { BookUser, Plus } from "@lucide/svelte";

  interface Props {
    officers: OfficerRecord[];
    residentId?: string;
    onRowClick?: (row: OfficerRecord) => void;
    class?: string;
  }

  let { officers = [], residentId = "", onRowClick, class: className }: Props = $props();

  const columns: ColumnDef<OfficerRecord>[] = [
    {
      accessorKey: "term",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Term" }),
      cell: ({ row }) => {
        const periodSnippet = createRawSnippet<[{ term: string }]>((p) => ({
          render: () => `<span class="font-medium">${translatePeriod(p().term)}</span>`
        }));
        return renderSnippet(periodSnippet, { term: row.original.term });
      }
    },
    {
      accessorKey: "position",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Position" }),
      cell: ({ row }) => {
        const posSnippet = createRawSnippet<[{ position: string; committee?: string }]>((p) => ({
          render: () => `
            <div class="flex flex-col">
              <span class="font-bold">${p().position}</span>
              ${p().committee ? `<span class="text-xs text-muted-foreground">${p().committee}</span>` : ""}
            </div>
          `
        }));
        return renderSnippet(posSnippet, {
          position: row.original.position,
          committee: row.original.committee
        });
      }
    },
    {
      accessorKey: "status",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
      cell: ({ row }) => {
        const statusSnippet = createRawSnippet<[{ status: string }]>((p) => {
          const s = p().status;
          const isAct = s === OfficerStatus.ACTIVE;
          const cls = isAct
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-muted text-muted-foreground";
          return {
            render: () =>
              `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${cls}">${s}</span>`
          };
        });
        return renderSnippet(statusSnippet, { status: row.original.status });
      }
    }
  ];
</script>

<Card.Root class="overflow-hidden {className}">
  <Card.Header class="flex flex-row items-center justify-between bg-muted/5">
    <Card.Title class="flex items-center gap-2 text-lg">
      <BookUser class="h-5 w-5" />
      Officer History
    </Card.Title>
    {#if residentId}
      <Button size="sm" href="/admin/residents/officers/add?residentId={residentId}" icon={Plus}>
        Assign as Officer
      </Button>
    {/if}
  </Card.Header>
  <Card.Content>
    {#if officers.length > 0}
      <DataTable
        data={officers}
        {columns}
        {onRowClick}
        rowId="id"
        sorting={[{ id: "term", desc: true }]}
      />
    {:else}
      <EmptyView
        title="No officer history"
        description="This resident has not been assigned to any officer positions."
        class="h-64"
      >
        {#snippet icon()}
          <BookUser class="h-10 w-10 text-muted-foreground/60" />
        {/snippet}
      </EmptyView>
    {/if}
  </Card.Content>
</Card.Root>
