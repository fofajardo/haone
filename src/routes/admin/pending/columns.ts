import {
  renderComponent,
  renderSnippet,
  DataTableSelectHeader,
  DataTableSelectCell,
  DataTableColumnHeader,
  type ColumnDef
} from "$ui/data-table/index.js";
import { formatDate, formatAccounting } from "$utils/formatters";
import CompositionCell from "$components/CompositionCell.svelte";
import type { JournalRecord } from "$lib/types";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<JournalRecord>[] = [
  {
    id: "select",
    header: ({ table }) => renderComponent(DataTableSelectHeader, { table }),
    cell: ({ row }) => renderComponent(DataTableSelectCell, { row }),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => {
      return formatDate(row.getValue("date") as string);
    }
  },
  {
    accessorKey: "name",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Account" }),
    cell: ({ row, table }) => {
      return renderComponent(CompositionCell, {
        record: row.original,
        variant: "account",
        // @ts-ignore
        transactionTypes: table.options.meta?.transactionTypes || []
      });
    }
  },
  {
    id: "composition",
    header: "Composition",
    cell: ({ row }) => {
      return renderComponent(CompositionCell, {
        record: row.original,
        variant: "composition"
      });
    }
  },
  {
    accessorKey: "mop",
    header: "Payment Details",
    cell: ({ row }) => {
      return renderComponent(CompositionCell, {
        record: row.original,
        variant: "mop"
      });
    }
  },
  {
    accessorKey: "amount",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Total", class: "ml-auto" }),
    cell: ({ row }) => {
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="text-right">${formatAccounting(p().amount)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: row.getValue("amount") as number });
    }
  }
];
