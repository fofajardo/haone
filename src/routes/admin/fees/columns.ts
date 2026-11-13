import type { FeeCodeConfig } from "$lib/types";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import { renderComponent, type ColumnDef } from "$ui/data-table/index.js";
import FeeCodeColorCell from "./FeeCodeColorCell.svelte";

export const createColumns = (): ColumnDef<FeeCodeConfig>[] => [
  {
    accessorKey: "label",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Label" })
  },
  {
    accessorKey: "shortLabel",
    header: "Short Label"
  },
  {
    accessorKey: "color",
    header: "Color",
    cell: ({ row }) => renderComponent(FeeCodeColorCell, { color: row.original.color })
  },
  {
    accessorKey: "canWaive",
    header: "Waivable",
    cell: ({ row }) => (row.original.canWaive ? "Yes" : "No")
  },
  {
    accessorKey: "isMandatory",
    header: "Mandatory",
    cell: ({ row }) => (row.original.isMandatory ? "Yes" : "No")
  },
  {
    accessorKey: "sortOrder",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Order" })
  }
];
