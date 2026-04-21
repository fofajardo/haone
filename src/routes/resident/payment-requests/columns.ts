import { type ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { formatAmount } from "$lib/receipt-utils";
import type { PaymentRequestRecord } from "$lib/schemas";
import { PaymentRequestStatus, PAYMENT_REQUEST_STATUS_COLORS } from "$lib/schemas";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";
import { Button } from "$lib/components/ui/button";

export const columns: ColumnDef<PaymentRequestRecord>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" })
  },
  {
    id: "amount",
    header: "Total",
    cell: ({ row }) => {
      const r = row.original;
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="font-bold text-sm">${formatAmount(p().amount)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: r.waterFee + r.assocFee + r.misc });
    }
  },
  {
    id: "breakdown",
    header: "Breakdown",
    cell: ({ row }) => {
      const r = row.original;
      const breakdownSnippet = createRawSnippet<[{ water: number; assoc: number; misc: number }]>(
        (p) => ({
          render: () => `
          <div class="text-[10px] text-muted-foreground leading-tight">
            W: ${formatAmount(p().water)} | A: ${formatAmount(p().assoc)} | M: ${formatAmount(p().misc)}
          </div>
        `
        })
      );
      return renderSnippet(breakdownSnippet, {
        water: r.waterFee,
        assoc: r.assocFee,
        misc: r.misc
      });
    }
  },
  {
    accessorKey: "mop",
    header: "MOP",
    cell: ({ row }) => {
      const mopSnippet = createRawSnippet<[{ mop: string }]>((p) => ({
        render: () => `<div class="text-xs font-medium uppercase">${p().mop}</div>`
      }));
      return renderSnippet(mopSnippet, { mop: row.getValue("mop") as string });
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
          const cls = PAYMENT_REQUEST_STATUS_COLORS[s] || PAYMENT_REQUEST_STATUS_COLORS.DEFAULT;
          return `<div class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase w-fit ${cls}">${s}</div>`;
        }
      }));
      return renderSnippet(statusSnippet, { status });
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
        children: createRawSnippet(() => ({
          render: () =>
            `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`
        }))
      });
    }
  }
];
