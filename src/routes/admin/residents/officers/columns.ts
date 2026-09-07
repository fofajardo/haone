import type { OfficerRecord } from "$lib/types";
import { brandingState } from "$state/branding.svelte";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import { renderComponent, type ColumnDef } from "$ui/data-table/index.js";
import OfficerNameCell from "./OfficerNameCell.svelte";
import OfficerStatusCell from "./OfficerStatusCell.svelte";

export const createColumns = (onSuccess: () => void): ColumnDef<OfficerRecord>[] => [
  {
    accessorKey: "position",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Position" }),
    sortFn: (rowA: any, rowB: any) => {
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
