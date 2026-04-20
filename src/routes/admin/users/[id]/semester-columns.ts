import type { ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { type ResidentRecord as Account } from "$lib/schemas";
import { translatePeriod } from "$lib/receipt-utils";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";

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
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Clearance" }),
    cell: ({ row }) => {
      const ceSnippet = createRawSnippet<[{ issued: string }]>((p) => ({
        render: () => {
          const issued = p().issued;
          const isCleared = issued && issued !== "" && issued !== "#N/A" && issued !== "N/A";
          const classes = isCleared
            ? "inline-flex items-center rounded-full border border-transparent bg-primary px-2.5 py-0.5 text-[10px] font-black text-primary-foreground uppercase tracking-tight"
            : "inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-black text-muted-foreground uppercase opacity-50 tracking-tight";
          return `<span class="${classes}">${isCleared ? "CLEARED" : "PENDING"}</span>`;
        }
      }));
      return renderSnippet(ceSnippet, { issued: row.original.ceIssued });
    }
  }
];
