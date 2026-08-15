<script lang="ts" generics="TData, TValue">
  import type { Snippet } from "svelte";
  import {
    type ColumnDef,
    type ColumnFiltersState,
    type PaginationState,
    type RowSelectionState,
    type SortingState,
    type VisibilityState,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel
  } from "@tanstack/table-core";
  import * as Table from "$ui/table/index.js";
  import { Button } from "$ui/button/index.js";
  import { Input } from "$ui/input/index.js";
  import { FlexRender, createSvelteTable } from "$ui/data-table/index.js";
  import { cn } from "$lib/utils";
  import * as NativeSelect from "$ui/native-select/index.js";
  import { pluralize } from "$utils/formatters";
  import { X } from "@lucide/svelte";
  import { fly } from "svelte/transition";

  type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    onRowClick?: (row: TData) => void;
    class?: string;
    tableClass?: string;
    filterSearch?: string;
    filterColumnId?: string;
    selectedRowIds?: Set<string>; // For external syncing if needed
    onSelectionChange?: (selectedIds: Set<string>) => void;
    pagination?: PaginationState;
    onPaginationChange?: (pagination: PaginationState) => void;
    rowId: keyof TData | ((row: TData) => string);
    enableSelection?: boolean;
    actions?: Snippet;
  };

  let {
    data,
    columns,
    onRowClick,
    class: className,
    tableClass,
    filterSearch = $bindable(""),
    filterColumnId,
    onSelectionChange,
    meta,
    pagination = $bindable({ pageIndex: 0, pageSize: 20 }),
    onPaginationChange: onPaginationChangeProp,
    rowId,
    enableSelection = false,
    actions
  }: DataTableProps<TData, TValue> & { meta?: any } = $props();

  let sorting = $state<SortingState>([]);
  let columnFilters = $state<ColumnFiltersState>([]);
  let rowSelection = $state<RowSelectionState>({});
  let columnVisibility = $state<VisibilityState>({});

  const table = createSvelteTable({
    get data() {
      return data;
    },
    get columns() {
      return columns;
    },
    get meta() {
      return meta;
    },
    state: {
      get pagination() {
        return pagination;
      },
      get sorting() {
        return sorting;
      },
      get columnVisibility() {
        return columnVisibility;
      },
      get rowSelection() {
        return rowSelection;
      },
      get columnFilters() {
        return columnFilters;
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => {
      if (typeof rowId === "function") {
        const id = rowId(row);
        if (!id) {
          throw new Error("DataTable: getRowId function returned empty ID");
        }
        return id;
      }
      if (rowId) {
        const id = row[rowId];
        if (id === undefined || id === null || id === "") {
          throw new Error(`DataTable: Row missing explicit ID field "${String(rowId)}"`);
        }
        return String(id);
      }
      throw new Error("DataTable: No rowId prop provided. Explicit row IDs are required.");
    },
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        pagination = updater(pagination);
      } else {
        pagination = updater;
      }
      onPaginationChangeProp?.(pagination);
    },
    onSortingChange: (updater) => {
      if (typeof updater === "function") sorting = updater(sorting);
      else sorting = updater;
    },
    onColumnFiltersChange: (updater) => {
      if (typeof updater === "function") columnFilters = updater(columnFilters);
      else columnFilters = updater;
    },
    onColumnVisibilityChange: (updater) => {
      if (typeof updater === "function") columnVisibility = updater(columnVisibility);
      else columnVisibility = updater;
    },
    onRowSelectionChange: (updater) => {
      if (typeof updater === "function") rowSelection = updater(rowSelection);
      else rowSelection = updater;
    }
  });

  // Sync external search with internal table filters
  $effect(() => {
    if (filterColumnId) {
      const col = table.getColumn(filterColumnId);
      if (col && col.getFilterValue() !== filterSearch) {
        col.setFilterValue(filterSearch);
      }
    }
  });

  // Sync selection back to parent if requested
  $effect(() => {
    if (onSelectionChange) {
      const selected = new Set(table.getFilteredSelectedRowModel().rows.map((row) => row.id));
      onSelectionChange(selected);
    }
  });

  const hasSelection = $derived(enableSelection);
</script>

<div class={cn("w-full", className)}>
  {#if hasSelection && table.getFilteredSelectedRowModel().rows.length > 0}
    {@const selectedCount = table.getFilteredSelectedRowModel().rows.length}
    {@const pageCount = table.getPaginationRowModel().rows.length}
    {@const totalFilteredCount = table.getFilteredRowModel().rows.length}
    {@const isAllPageSelected = table.getIsAllPageRowsSelected()}
    {@const isAllMatchSelected = table.getIsAllRowsSelected()}

    <div
      transition:fly={{ y: 16, duration: 180 }}
      class="fixed inset-x-3 bottom-22 z-30 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lg transition-all sm:sticky sm:inset-auto sm:top-2 sm:z-20 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5 sm:shadow-sm"
    >
      <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {#if isAllPageSelected && !isAllMatchSelected && totalFilteredCount > pageCount}
          <span>
            All <span class="font-semibold text-foreground">{pageCount}</span> on page selected.
          </span>
          <Button
            variant="link"
            size="sm"
            class="font-semibold text-primary"
            onclick={() => table.toggleAllRowsSelected(true)}
          >
            Select all {totalFilteredCount} in match
          </Button>
        {:else}
          <span>
            <span class="font-semibold text-foreground">{selectedCount}</span> of
            <span class="font-semibold text-foreground">{totalFilteredCount}</span> selected
          </span>
        {/if}
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onclick={() => table.resetRowSelection()} icon={X}>Clear</Button>
        {#if actions}
          {@render actions()}
        {/if}
      </div>
    </div>
  {/if}

  <div class="rounded-md border">
    <Table.Root class={tableClass}>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup, i (headerGroup.id)}
          <Table.Row>
            {#each headerGroup.headers as header (header.id)}
              {#if header.isPlaceholder}
                <Table.Head
                  class="[&:has([role=checkbox])]:text-center"
                  rowspan={table.getHeaderGroups().length - i}
                >
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                </Table.Head>
              {:else if !header.column.parent && i > 0}
                <!-- Omit to respect rowspan from above -->
              {:else}
                <Table.Head class="[&:has([role=checkbox])]:text-center" colspan={header.colSpan}>
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                </Table.Head>
              {/if}
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#each table.getRowModel().rows as row (row.id)}
          <Table.Row
            data-state={row.getIsSelected() && "selected"}
            onclick={() => onRowClick?.(row.original)}
            class={cn(onRowClick && "cursor-pointer")}
          >
            {#each row.getVisibleCells() as cell (cell.id)}
              <Table.Cell class="[&:has([role=checkbox])]:text-center">
                <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-24 text-center">No results.</Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <div class="flex flex-col items-center justify-between gap-4 py-4 md:flex-row">
    <div class="flex flex-col items-center gap-4 text-sm sm:flex-row sm:gap-6">
      <span class="whitespace-nowrap">
        Total of {pluralize(table.getFilteredRowModel().rows.length, "entry", "entries")}.
      </span>
    </div>
    <div class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
      <div class="flex items-center gap-2 text-sm font-medium">
        <span>Rows per page</span>
        <NativeSelect.Root
          value={table.getState().pagination.pageSize >= 1000000
            ? "all"
            : table.getState().pagination.pageSize.toString()}
          onchange={(e) => {
            const val = e.currentTarget.value;
            table.setPageSize(val === "all" ? Number.MAX_SAFE_INTEGER : Number(val));
          }}
          class="h-8 w-20 px-1 text-xs"
        >
          {#each [10, 20, 50, 100] as size}
            <NativeSelect.Option value={size.toString()}>{size}</NativeSelect.Option>
          {/each}
          <NativeSelect.Option value="all">All</NativeSelect.Option>
        </NativeSelect.Root>
      </div>
      <div class="flex items-center justify-center gap-2 text-sm font-medium">
        <span>Page</span>
        <Input
          type="number"
          class="h-8 w-12 [appearance:textfield] px-1 text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={table.getState().pagination.pageIndex + 1}
          onchange={(e) => {
            const val = Number(e.currentTarget.value);
            if (isNaN(val)) return;
            const page = Math.max(0, Math.min(val - 1, table.getPageCount() - 1));
            table.setPageIndex(page);
          }}
        />
        <span class="whitespace-nowrap">of {table.getPageCount()}</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onclick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onclick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</div>
