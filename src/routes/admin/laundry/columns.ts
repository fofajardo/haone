import type { ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import { type LaundryRecord } from "$lib/schemas";
import DataTableColumnHeader from "$lib/components/ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { XCircle } from "lucide-svelte";
import { parseTime } from "$lib/receipt-utils";

export const columns: ColumnDef<LaundryRecord>[] = [
  {
    accessorKey: "residentId",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Resident" }),
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      const user = meta?.userMap?.get(row.original.residentId);
      const name = user?.displayName || row.original.residentId;
      const room = user?.room ? `Room ${user.room}` : "";

      const snippet = createRawSnippet<[{ name: string; room: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col">
            <span class="text-sm text-foreground font-semibold">${p().name}</span>
            ${p().room ? `<span class="text-xs text-muted-foreground font-medium uppercase tracking-tighter">${p().room}</span>` : ""}
          </div>
        `
      }));
      return renderSnippet(snippet, {
        name,
        room
      });
    }
  },
  {
    accessorKey: "date",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Date" }),
    cell: ({ row }) => {
      const snippet = createRawSnippet<[{ val: string }]>((p) => ({
        render: () => `<span class="text-sm font-medium">${p().val}</span>`
      }));
      return renderSnippet(snippet, { val: row.original.date });
    }
  },
  {
    accessorKey: "timeStart",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Schedule" }),
    cell: ({ row }) => {
      const snippet = createRawSnippet<[{ start: string; end: string }]>((p) => ({
        render: () => `
          <div class="flex items-center gap-1.5 text-sm">
            <span class="font-bold">${p().start}</span>
            <span class="text-muted-foreground">→</span>
            <span class="font-bold">${p().end}</span>
          </div>
        `
      }));
      return renderSnippet(snippet, {
        start: row.original.timeStart,
        end: row.original.timeEnd
      });
    }
  },
  {
    accessorKey: "status",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
    cell: ({ row }) => {
      const status = row.original.status;
      const reason = row.original.cancelReason;
      const snippet = createRawSnippet<[{ status: string; reason: string }]>((p) => ({
        render: () => {
          const s = p().status;
          const r = p().reason;
          const isCancelled = s.startsWith("CANCELLED");
          const colorClass =
            s === "ACTIVE"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

          return `
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-tighter ${colorClass}">
                ${s.replace(/_/g, " ")}
              </span>
              ${isCancelled && r ? `<span class="text-xs text-muted-foreground italic truncate max-w-[120px]">(${r})</span>` : ""}
            </div>
          `;
        }
      }));
      return renderSnippet(snippet, { status, reason });
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      const res = row.original;

      const isPast = (date: string, time: string) => {
        const start = parseTime(time);
        const [y, m, d] = date.split("-").map(Number);
        const dt = new Date(y, m - 1, d, start);
        return dt < new Date();
      };

      if (res.status === "ACTIVE" && !isPast(res.date, res.timeStart)) {
        const snippet = createRawSnippet<[{ id: string }]>((p) => ({
          render: () => `
            <div class="flex justify-end">
              <button 
                class="inline-flex items-center justify-center rounded-md h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                onclick="window.__laundry_cancel?.('${p().id}')"
                title="Cancel Reservation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-circle"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              </button>
            </div>
          `
        }));

        // Expose the cancel function globally for the snippet to call
        if (typeof window !== "undefined") {
          (window as any).__laundry_cancel = meta?.onCancel;
        }

        return renderSnippet(snippet, { id: res.id });
      }
      return null;
    }
  }
];
