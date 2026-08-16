import { renderComponent, renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
import { formatDate, formatAccounting } from "$utils/formatters";
import { translateMop, translateType } from "$utils/translators";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import DataTableCheckbox from "$ui/data-table/data-table-checkbox.svelte";
import { type JournalRecord } from "$lib/types";
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
            <div class="flex md:block md:whitespace-normal md:max-w-55 md:wrap-break-word">
              <span class="text-sm font-medium">${r.creatorName}</span>
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
            <div class="flex md:block md:whitespace-normal md:max-w-50 md:wrap-break-word">
              <span class="text-sm font-medium">${r.name}</span>
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
  },
  {
    accessorKey: "runningBalance",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<div class="text-right flex-1">Balance</div>`
      }));
      return renderSnippet(headerSnippet, {});
    },
    cell: ({ row }) => {
      const balSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () =>
          `<div class="text-right text-sm font-medium ${p().amount < 0 ? "text-primary" : ""}">${formatAccounting(p().amount || 0)}</div>`
      }));
      return renderSnippet(balSnippet, { amount: row.original.runningBalance ?? 0 });
    }
  }
];
