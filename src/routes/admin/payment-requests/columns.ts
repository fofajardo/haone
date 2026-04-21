import { type ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { formatAmount } from "$lib/receipt-utils";
import type { PaymentRequestRecord } from "$lib/schemas";
import { PaymentRequestStatus, PAYMENT_REQUEST_STATUS_COLORS } from "$lib/schemas";
import DataTableCheckbox from "$lib/components/ui/data-table/data-table-checkbox.svelte";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";
import { Button } from "$lib/components/ui/button";
import { Eye } from "lucide-svelte";

export const columns: ColumnDef<PaymentRequestRecord>[] = [
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
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" })
  },
  {
    accessorKey: "residentId",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
    cell: ({ row, table }) => {
      const resId = row.original.residentId;
      // @ts-ignore
      const residents = table.options.meta?.residents || [];
      const resident = residents.find((r: any) => r.residentId === resId);
      const name = resident ? resident.name : resId;
      const email = resident ? resident.email : "N/A";

      const residentSnippet = createRawSnippet<[{ name: string; email: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col">
            <span class="text-sm font-medium">${p().name}</span>
            <span class="text-xs text-muted-foreground">${p().email}</span>
          </div>
        `
      }));
      return renderSnippet(residentSnippet, { name, email });
    }
  },
  {
    id: "amount",
    header: "Total",
    cell: ({ row }) => {
      const r = row.original;
      const amountSnippet = createRawSnippet<[{ amount: number }]>((p) => ({
        render: () => `<div class="font-bold">${formatAmount(p().amount)}</div>`
      }));
      return renderSnippet(amountSnippet, { amount: r.waterFee + r.assocFee + r.misc });
    }
  },
  {
    accessorKey: "mop",
    header: "MOP"
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusSnippet = createRawSnippet<[{ status: string }]>((p) => ({
        render: () => {
          const s = p().status;
          const cls = PAYMENT_REQUEST_STATUS_COLORS[s as keyof typeof PAYMENT_REQUEST_STATUS_COLORS] || PAYMENT_REQUEST_STATUS_COLORS.DEFAULT;
          return `<div class="text-xs font-bold px-2 py-0.5 rounded-full uppercase w-fit ${cls}">${s}</div>`;
        }
      }));
      return renderSnippet(statusSnippet, { status });
    }
  }
];
