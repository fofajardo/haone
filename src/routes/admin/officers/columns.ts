import { renderComponent } from "$lib/components/ui/data-table";
import type { ColumnDef } from "@tanstack/table-core";
import type { OfficerRecord } from "$lib/schemas";
import OfficerNameCell from "./OfficerNameCell.svelte";
import OfficerStatusCell from "./OfficerStatusCell.svelte";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { brandingState } from "$lib/state/branding.svelte";

export const createColumns = (onSuccess: () => void): ColumnDef<OfficerRecord>[] => [
  {
    accessorKey: "position",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Position" }),
    sortingFn: (rowA, rowB) => {
      const positions = (brandingState.profile.officerPositions as { title: string }[]).map(
        (p) => p.title
      );
      const indexA = positions.indexOf(rowA.original.position);
      const indexB = positions.indexOf(rowB.original.position);

      // If not found, put at the end
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;

      return posA - posB;
    }
  },
  {
    accessorKey: "name",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Officer" }),
    cell: ({ row }) => {
      return renderComponent(OfficerNameCell, { officer: row.original });
    }
  },
  {
    accessorKey: "nickname",
    header: "Nickname"
  },
  {
    accessorKey: "committee",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Committee" })
  },
  {
    accessorKey: "birthday",
    header: "Birthday"
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return renderComponent(OfficerStatusCell, { status: row.original.status });
    }
  }
];
