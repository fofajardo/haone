<script lang="ts">
  import { renderComponent, renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
  import { createRawSnippet } from "svelte";
  import { type ResidentRecord as Account } from "$lib/types";
  import * as Card from "$ui/card";
  import { Badge } from "$ui/badge";
  import { translatePeriod } from "$utils/translators";
  import { pluralize, formatDate } from "$utils/formatters";
  import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import { Clock, History } from "@lucide/svelte";

  interface Props {
    accounts: Account[];
    onRowClick?: (row: Account) => void;
    class?: string;
  }

  let { accounts, onRowClick, class: className }: Props = $props();

  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: "period",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Period" }),
      cell: ({ row }) => {
        const periodSnippet = createRawSnippet<[{ period: string }]>((p) => ({
          render: () => `<span class="font-medium">${translatePeriod(p().period)}</span>`
        }));
        return renderSnippet(periodSnippet, { period: row.original.period });
      }
    },
    {
      accessorKey: "room",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Room" })
    },
    {
      accessorKey: "bed",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Bed" })
    },
    {
      accessorKey: "checkInDate",
      header: ({ column }) =>
        renderComponent(DataTableColumnHeader, { column, title: "Check-in Date" }),
      cell: ({ row }) => {
        const dateSnippet = createRawSnippet<[{ date?: string }]>((p) => ({
          render: () => `<span>${p().date ? formatDate(p().date!) : "—"}</span>`
        }));
        return renderSnippet(dateSnippet, { date: row.original.checkInDate });
      }
    },
    {
      accessorKey: "ceIssued",
      header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
      cell: ({ row }) => renderComponent(StatusBadge, { account: row.original })
    }
  ];
</script>

<Card.Root class="overflow-hidden {className}">
  <Card.Header class="flex flex-row items-center justify-between bg-muted/5">
    <Card.Title class="flex items-center gap-2 text-lg">
      <History class="h-5 w-5" />
      Occupancy History
    </Card.Title>
  </Card.Header>
  <Card.Content>
    {#if accounts.length > 0}
      <DataTable
        data={accounts}
        {columns}
        {onRowClick}
        rowId="ledgerId"
        sorting={[{ id: "period", desc: true }]}
      />
    {:else}
      <div class="flex flex-col items-center justify-center py-16 opacity-30">
        <Clock class="mb-2 h-8 w-8" />
        <p class="text-xs font-bold tracking-widest uppercase">No occupancy records</p>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
