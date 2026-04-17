import type { ColumnDef } from "@tanstack/table-core";
import { renderSnippet } from "$lib/components/ui/data-table/index.js";
import { formatDate, formatCurrency, translateMop, translateType } from "$lib/receipt-utils";
import { type JournalRecord } from "$lib/schemas";
import { createRawSnippet } from "svelte";

export const columns: ColumnDef<JournalRecord>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => {
      const dateSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        return {
          render: () => `
            <div class="flex flex-col">
              <span class="text-sm font-medium text-foreground"
                >${formatDate(r.date)}</span
              >
              <span class="text-sm text-muted-foreground">${r.creator}</span>
            </div>
          `
        };
      });
      return renderSnippet(dateSnippet, { record: row.original });
    }
  },
  {
    accessorKey: "type",
    header: "Type/MOP",
    cell: ({ row, table }) => {
      const typeSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
        const r = p().record;
        // @ts-ignore
        const transactionTypes = table.options.meta?.transactionTypes || [];
        return {
          render: () => `
            <div class="flex flex-col">
              <span class="text-sm font-medium">${translateType(r.type, transactionTypes)}</span>
              <span class="text-sm text-muted-foreground">${translateMop(r.mop)}</span>
            </div>
          `
        };
      });
      return renderSnippet(typeSnippet, { record: row.original });
    }
  },
  {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ row }) => {
      const notesSnippet = createRawSnippet<[{ notes: string }]>((p) => ({
        render: () => `
          <p class="max-w-[300px] truncate text-sm leading-tight text-muted-foreground" title="${p().notes || ""}">
            ${p().notes || "—"}
          </p>
        `
      }));
      return renderSnippet(notesSnippet, { notes: row.original.notes });
    }
  },
  {
    accessorKey: "amount",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-right text-sm font-medium">Amount</div>`
      }));
      return renderSnippet(headerSnippet);
    },
    cell: ({ row }) => {
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm font-medium">${formatCurrency(p().amount || 0)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: row.original.amount });
    }
  }
];
