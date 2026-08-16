<script lang="ts">
  import { renderSnippet, type ColumnDef } from "$ui/data-table/index.js";
  import { formatDate, formatCurrency, pluralize } from "$utils/formatters";
  import { translateMop, translateType } from "$utils/translators";
  import { type JournalRecord } from "$lib/types";
  import { createRawSnippet } from "svelte";
  import * as Card from "$ui/card";
  import { Badge } from "$ui/badge";
  import { History, Clock } from "@lucide/svelte";
  import DataTable from "$ui/data-table/data-table.svelte";
  import EmptyView from "$components/EmptyView.svelte";

  interface Props {
    history: JournalRecord[];
    transactionTypes?: { value: string; label: string }[];
    onRowClick?: (row: JournalRecord) => void;
    class?: string;
  }

  let { history, transactionTypes = [], onRowClick, class: className }: Props = $props();

  const columns: ColumnDef<JournalRecord>[] = [
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
      cell: ({ row }) => {
        const typeSnippet = createRawSnippet<[{ record: JournalRecord }]>((p) => {
          const r = p().record;
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
</script>

{#if history.length > 0}
  <Card.Root class="overflow-hidden {className}">
    <Card.Header class="flex flex-row items-center justify-between bg-muted/5">
      <Card.Title class="flex items-center gap-2 text-lg">
        <History class="h-5 w-5" />
        Transaction History
      </Card.Title>
    </Card.Header>
    <Card.Content>
      <DataTable data={history} {columns} {onRowClick} rowId="id" />
    </Card.Content>
  </Card.Root>
{:else}
  <EmptyView
    title="No transaction history found."
    description="Transactions for this term will appear here."
  >
    {#snippet icon()}
      <Clock class="h-8 w-8 text-muted-foreground" />
    {/snippet}
  </EmptyView>
{/if}
