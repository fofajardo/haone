import { type ColumnDef } from "@tanstack/table-core";
import { renderComponent } from "$lib/components/ui/data-table/index.js";
import type { AnnouncementRecord } from "$lib/types";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { formatDate } from "$lib/utils/formatters";

import AnnouncementStatusCell from "./AnnouncementStatusCell.svelte";
import AnnouncementTagsCell from "./AnnouncementTagsCell.svelte";
import AnnouncementTitleCell from "./AnnouncementTitleCell.svelte";

import SelectionCell from "./SelectionCell.svelte";
import SelectionHeader from "./SelectionHeader.svelte";

export const columns: ColumnDef<AnnouncementRecord>[] = [
  {
    id: "select",
    header: ({ table }) => renderComponent(SelectionHeader, { table }),
    cell: ({ row }) => renderComponent(SelectionCell, { row }),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: "status",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
    cell: ({ row }) => renderComponent(AnnouncementStatusCell, { row })
  },
  {
    accessorKey: "title",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Announcement" }),
    cell: ({ row }) => renderComponent(AnnouncementTitleCell, { row })
  },
  {
    accessorKey: "tags",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Tags" }),
    cell: ({ row }) => renderComponent(AnnouncementTagsCell, { row })
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Start" }),
    cell: ({ row }) => formatDate(row.original.startDate)
  },
  {
    accessorKey: "expiryDate",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Expiry" }),
    cell: ({ row }) => {
      if (row.original.isIndefinite) return "Indefinite";
      return formatDate(row.original.expiryDate);
    }
  },
  {
    accessorKey: "broadcastCount",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Broadcasts" }),
    cell: ({ row }) => {
      const count = row.original.broadcastCount;
      if (count === 0) return "Never";
      return count;
    }
  }
];
