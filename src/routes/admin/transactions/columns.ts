import type { ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { formatDate, formatAccounting, translateMop, translateType } from "$lib/receipt-utils";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { type JournalRecord } from "$lib/schemas";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<JournalRecord>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => {
      const dateSnippet = createRawSnippet<[{ date: string }]>((p) => ({
        render: () => `<span class="text-sm">${formatDate(p().date)}</span>`
      }));
      return renderSnippet(dateSnippet, { date: row.original.date });
    }
  },
  {
    accessorKey: "creatorName",
    header: "Recorder",
    cell: ({ row }) => {
      const creatorSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () => `
            <div class="flex flex-col">
              <span class="text-sm font-medium">${r.creatorName}</span>
              <span class="text-sm text-muted-foreground">${r.creator}</span>
            </div>
          `
        };
      });
      return renderSnippet(creatorSnippet, { record: row.original });
    }
  },
  {
    accessorKey: "name",
    header: "Account",
    cell: ({ row }) => {
      const accountSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () => `
            <div class="flex flex-col">
              <span class="text-sm font-medium">${r.name}</span>
              <span class="text-sm text-muted-foreground">${r.account}</span>
            </div>
          `
        };
      });
      return renderSnippet(accountSnippet, { record: row.original });
    }
  },
  {
    id: "details",
    header: "Details",
    cell: ({ row, table }) => {
      const detailsSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        // @ts-ignore
        const transactionTypes = table.options.meta?.transactionTypes || [];
        return {
          render: () => `
            <div class="flex flex-col gap-2">
              <div class="flex flex-col">
                <span class="text-sm uppercase">${translateType(r.type, transactionTypes)}</span>
                <span class="text-sm text-muted-foreground">${translateMop(r.mop)}</span>
              </div>
              ${r.notes ? `<span class="text-sm text-muted-foreground truncate max-w-[300px] block italic">— ${r.notes}</span>` : ""}
            </div>
          `
        };
      });
      return renderSnippet(detailsSnippet, { record: row.original });
    }
  },
  {
    accessorKey: "amount",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-right flex-1">Total</div>`
      }));
      return renderSnippet(headerSnippet, {});
    },
    cell: ({ row }) => {
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm font-medium">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: row.original.amount });
    }
  }
];
