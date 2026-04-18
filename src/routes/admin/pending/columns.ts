import { type ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { formatDate, formatAccounting } from "$lib/receipt-utils";
import CompositionCell from "./CompositionCell.svelte";
import type { JournalRecord } from "$lib/schemas";
import DataTableCheckbox from "$lib/components/ui/data-table/data-table-checkbox.svelte";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<JournalRecord>[] = [
  {
    id: "select",
    header: ({ table }) =>
      renderComponent(DataTableCheckbox, {
        checked: table.getIsAllPageRowsSelected(),
        indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
        onCheckedChange: (value: boolean) => table.toggleAllPageRowsSelected(!!value),
        "aria-label": "Select all"
      }),
    cell: ({ row }) =>
      renderComponent(DataTableCheckbox, {
        checked: row.getIsSelected(),
        onCheckedChange: (value: boolean) => row.toggleSelected(!!value),
        "aria-label": "Select row",
        onclick: (e: MouseEvent) => e.stopPropagation()
      }),
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
