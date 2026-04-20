import type { ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { createRawSnippet } from "svelte";
import { type ResidentRecord as Account } from "$lib/schemas";
import { translatePeriod } from "$lib/receipt-utils";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import StatusBadge from "./StatusBadge.svelte";

export const columns: ColumnDef<Account>[] = [
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
    accessorKey: "ceIssued",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
    cell: ({ row }) => renderComponent(StatusBadge, { account: row.original })
  }
];
