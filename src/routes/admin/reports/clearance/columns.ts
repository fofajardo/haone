import type { ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import type { ResidentRecord } from "$lib/schemas";
import { formatAccounting } from "$lib/receipt-utils";
import { createRawSnippet } from "svelte";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";

export const columns: ColumnDef<ResidentRecord>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
    cell: ({ row }) => {
      const r = row.original;
      const snippet = createRawSnippet<[{ name: string }]>((p) => ({
        render: () => `<span class="font-medium text-foreground">${p().name}</span>`
      }));
      return renderSnippet(snippet, { name: r.name });
    }
  },
  {
    accessorKey: "room",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Room" }),
    cell: ({ row }) => {
      const r = row.original;
      const snippet = createRawSnippet<[{ room: string }]>((p) => ({
        render: () => `<span>${p().room}</span>`
      }));
      return renderSnippet(snippet, { room: r.room });
    }
  },
  {
    accessorKey: "bed",
    header: "Bed",
    cell: ({ row }) => {
      const r = row.original;
      const snippet = createRawSnippet<[{ bed: string }]>((p) => ({
        render: () => `<span>${p().bed}</span>`
      }));
      return renderSnippet(snippet, { bed: r.bed });
    }
  },
  {
    accessorKey: "totalBase",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Base", class: "ml-auto" }),
    cell: ({ row }) => {
      const amount = row.original.totalBase;
      const snippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(snippet, { amount });
    }
  },
  {
    accessorKey: "paid",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Paid", class: "ml-auto" }),
    cell: ({ row }) => {
      const amount = row.original.paid;
      const snippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="text-right text-sm">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(snippet, { amount });
    }
  },
  {
    accessorKey: "waived",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Waived", class: "ml-auto" }),
    cell: ({ row }) => {
      const amount = row.original.waived;
      const snippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm text-muted-foreground">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(snippet, { amount });
    }
  },
  {
    accessorKey: "bal",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Balance", class: "ml-auto" }),
    cell: ({ row }) => {
      const amount = row.original.bal;
      const snippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm font-medium">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(snippet, { amount });
    }
  },
  {
    id: "progress",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, {
        column,
        title: "Status/Progress",
        class: "mx-auto"
      }),
    cell: ({ row }) => {
      const r = row.original;
      const progress = r.totalBase > 0 ? ((r.paid + r.waived) / r.totalBase) * 100 : 0;

      const snippet = createRawSnippet<[{ r: ResidentRecord; progress: number }]>((p) => {
        const res = p().r;
        const prog = p().progress;

        if (res.ceIssued && res.ceIssued !== "" && res.ceIssued !== "#N/A") {
          return {
            render: () =>
              `<div class="flex justify-center"><div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-brand/10 text-brand">Cleared ${res.ceIssued}</div></div>`
          };
        }

        return {
          render: () => `
            <div class="flex items-center justify-center gap-2">
              <div class="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                <div class="h-full bg-brand transition-all" style="width: ${Math.min(100, prog)}%"></div>
              </div>
              <span class="text-[10px] font-bold">${Math.round(prog)}%</span>
            </div>
          `
        };
      });

      return renderSnippet(snippet, { r, progress });
    }
  }
];
