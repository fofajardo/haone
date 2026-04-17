import type { ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { type ResidentRecord as Resident } from "$lib/schemas";
import { formatAccounting } from "$lib/receipt-utils";
import DataTableCheckbox from "$lib/components/ui/data-table/data-table-checkbox.svelte";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<Resident>[] = [
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
    accessorKey: "name",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
    cell: ({ row }) => {
      const nameSnippet = createRawSnippet<[{ name: string }]>((p) => ({
        render: () => `<span class="font-medium">${p().name}</span>`
      }));
      return renderSnippet(nameSnippet, { name: row.original.name });
    }
  },
  {
    accessorKey: "room",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Room" }),
    cell: ({ row }) => {
      const roomSnippet = createRawSnippet<[{ room?: string }]>((p) => ({
        render: () => `<span>${p().room || "—"}</span>`
      }));
      return renderSnippet(roomSnippet, { room: row.original.room });
    }
  },
  {
    accessorKey: "bed",
    header: "Bed",
    cell: ({ row }) => {
      const bedSnippet = createRawSnippet<[{ bed?: string }]>((p) => ({
        render: () => `<span>${p().bed || "—"}</span>`
      }));
      return renderSnippet(bedSnippet, { bed: row.original.bed });
    }
  },
  {
    id: "balances",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-center w-full font-semibold">Balance</div>`
      }));
      return renderSnippet(headerSnippet, {});
    },
    columns: [
      {
        accessorKey: "waterBal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, { column, title: "Water Fee", class: "ml-auto" }),
        cell: ({ row }) => {
          const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
            render: () =>
              `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
          }));
          return renderSnippet(amountSnippet, { amount: row.original.waterBal });
        }
      },
      {
        accessorKey: "assocBal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, {
            column,
            title: "Association Fee",
            class: "ml-auto"
          }),
        cell: ({ row }) => {
          const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
            render: () =>
              `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
          }));
          return renderSnippet(amountSnippet, { amount: row.original.assocBal });
        }
      },
      {
        accessorKey: "bal",
        header: ({ column }) =>
          renderComponent(DataTableColumnHeader, {
            column,
            title: "Outstanding",
            class: "ml-auto"
          }),
        cell: ({ row }) => {
          const balSnippet = createRawSnippet<[{ r: Resident }]>((p) => {
            const res = p().r;
            return {
              render: () =>
                `<div class="text-right text-sm font-medium">${formatAccounting(res.bal || 0)}</div>`
            };
          });
          return renderSnippet(balSnippet, { r: row.original });
        }
      }
    ]
  },
  {
    accessorKey: "isFullyPaid",
    id: "status", // Keep id as status for filtering/hiding if needed
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Status", class: "mx-auto" }),
    cell: ({ row }) => {
      return renderComponent(ResidentStatusCell, { resident: row.original });
    }
  }
];

import ResidentStatusCell from "./ResidentStatusCell.svelte";
