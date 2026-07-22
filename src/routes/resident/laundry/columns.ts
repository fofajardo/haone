import { type ColumnDef } from "@tanstack/table-core";
import { renderComponent, renderSnippet } from "$ui/data-table/index.js";
import { type LaundryRecord, LaundryStatus } from "$lib/types";
import DataTableColumnHeader from "$ui/data-table/data-table-column-header.svelte";
import { createRawSnippet } from "svelte";
import { parseTime } from "$utils/parsers";
import { formatDate } from "$utils/formatters";

export const columns: ColumnDef<LaundryRecord>[] = [
  {
    accessorKey: "creationTimestamp",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Booking Date" }),
    cell: ({ row }) => {
      const date = formatDate(row.original.creationTimestamp || "");
      const snippet = createRawSnippet<[{ val: string }]>((p) => ({
        render: () => `<span class="font-medium">${p().val}</span>`
      }));
      return renderSnippet(snippet, { val: date });
    }
  },
  {
    accessorKey: "date",
    header: ({ column }) =>
      renderComponent(DataTableColumnHeader, { column, title: "Reservation" }),
    cell: ({ row }) => {
      const date = formatDate(row.original.date);
      const start = row.original.timeStart;
      const end = row.original.timeEnd;

      const snippet = createRawSnippet<[{ date: string; start: string; end: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col">
            <span class="font-medium">${p().date}</span>
            <span>${p().start}–${p().end}</span>
          </div>
        `
      }));
      return renderSnippet(snippet, { date, start, end });
    }
  },
  {
    id: "status",
    header: ({ column }) => renderComponent(DataTableColumnHeader, { column, title: "Status" }),
    accessorFn: (res) => {
      if ((res as any)._effectiveStatus) return (res as any)._effectiveStatus;

      if (res.status === LaundryStatus.ACTIVE) {
        if (!res.date || !res.timeEnd) return res.status;
        const [y, m, day] = res.date.split("-").map(Number);
        const h = parseTime(res.timeEnd);
        const endDt = new Date(y, m - 1, day, h, 0);
        if (!isNaN(endDt.getTime()) && endDt < new Date()) {
          return LaundryStatus.COMPLETED;
        }
      }
      return res.status;
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const reason = row.original.cancelReason;

      const isCancelled = status.startsWith("CANCELLED");
      const isCompleted = status === LaundryStatus.COMPLETED;

      const colorClass =
        status === LaundryStatus.ACTIVE
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : isCompleted
            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

      const snippet = createRawSnippet<[{ status: string; reason: string }]>((p) => ({
        render: () => `
          <div class="flex flex-col gap-1.5">
            <div>
              <span class="inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${colorClass}">
                ${p().status.replace(/_/g, " ")}
              </span>
            </div>
            ${isCancelled && p().reason ? `<span class="text-muted-foreground italic text-xs leading-tight line-clamp-2">(${p().reason})</span>` : ""}
          </div>
        `
      }));
      return renderSnippet(snippet, { status, reason });
    }
  }
];
