import type { RowData } from "@tanstack/svelte-table";

export { default as DataTableCheckbox } from "./data-table-checkbox.svelte";
export { default as DataTableColumnHeader } from "./data-table-column-header.svelte";
export { default as DataTableSelectHeader } from "./data-table-select-header.svelte";
export { default as DataTableSelectCell } from "./data-table-select-cell.svelte";
export { default as DataTable } from "./data-table.svelte";

export {
  createTable,
  FlexRender,
  renderComponent,
  renderSnippet,
  tableFeatures,
  stockFeatures
} from "@tanstack/svelte-table";
export type {
  ColumnDef as TanStackColumnDef,
  RowData,
  Table,
  Row,
  Cell,
  Column,
  HeaderContext,
  CellContext,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  PaginationState,
  ColumnVisibilityState,
  TableOptions,
  StockFeatures
} from "@tanstack/svelte-table";

export type ColumnDef<
  TData extends RowData = any,
  TValue = any
> = import("@tanstack/svelte-table").ColumnDef<
  import("@tanstack/svelte-table").StockFeatures,
  TData,
  TValue
>;
