import { type ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { formatDate, formatAccounting } from "$lib/utils/formatters";
import { translateMop } from "$lib/utils/translators";
import type { PaymentRequestRecord } from "$lib/schemas";
import { PaymentRequestStatus, PAYMENT_REQUEST_STATUS_COLORS } from "$lib/schemas";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";
import { Button } from "$lib/components/ui/button";
import CompositionCell from "$lib/components/CompositionCell.svelte";
import { Trash2 } from "@lucide/svelte";

export const columns: ColumnDef<PaymentRequestRecord>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => formatDate(row.getValue("date"))
  },
  {
    id: "composition",
    header: "Composition",
    cell: ({ row }) => {
      const r = row.original;
      return renderComponent(CompositionCell, {
        variant: "composition",
        record: {
          ...r,
          water: r.waterFee,
          assoc: r.assocFee,
          misc: r.misc
        } as any
      });
    }
  },
  {
    id: "details",
    header: "Payment Details",
    cell: ({ row }) => {
      const r = row.original;
      const snippet = createRawSnippet<[{ mop: string; notes: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col">
            <span class="text-sm font-medium uppercase">${translateMop(p().mop)}</span>
            ${p().notes ? `<span class="text-sm text-muted-foreground italic truncate max-w-[200px] block">— ${p().notes}</span>` : ""}
          </div>
        `
      }));
      return renderSnippet(snippet, { mop: r.mop, notes: r.notes });
    }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusSnippet = createRawSnippet<[{ status: string }]>((p) => ({
        render: () => {
          const s = p().status;
          const cls =
            PAYMENT_REQUEST_STATUS_COLORS[s as keyof typeof PAYMENT_REQUEST_STATUS_COLORS] ||
            PAYMENT_REQUEST_STATUS_COLORS.DEFAULT;
          return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-tight uppercase ${cls}">${s}</span>`;
        }
      }));
      return renderSnippet(statusSnippet, { status });
    }
  },
  {
    id: "total",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Total", class: "ml-auto" }),
    cell: ({ row }) => {
      const r = row.original;
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="text-right font-bold">${formatAccounting(p().amount)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: r.waterFee + r.assocFee + r.misc });
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const r = row.original;
      if (r.status !== PaymentRequestStatus.PENDING) return null;

      // @ts-ignore
      const onCancel = table.options.meta?.onCancel;

      return renderComponent(Button, {
        variant: "ghost",
        size: "icon",
        class: "h-8 w-8 text-muted-foreground hover:text-destructive",
        onclick: (e: MouseEvent) => {
          e.stopPropagation();
          onCancel?.(r.id);
        },
        icon: Trash2
      });
    }
  }
];
