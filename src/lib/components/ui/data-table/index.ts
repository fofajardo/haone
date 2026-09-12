import type { RowData } from "@tanstack/svelte-table";

export { default as DataTableCheckbox } from "./data-table-checkbox.svelte";
export { default as DataTableColumnHeader } from "./data-table-column-header.svelte";
export { default as DataTableSelectCell } from "./data-table-select-cell.svelte";
export { default as DataTableSelectHeader } from "./data-table-select-header.svelte";
export { default as DataTable } from "./data-table.svelte";

export {
  createTable,
  FlexRender,
  renderComponent,
  renderSnippet,
  stockFeatures,
  tableFeatures
} from "@tanstack/svelte-table";
export type {
  Cell,
  CellContext,
  Column,
  ColumnFiltersState,
  ColumnVisibilityState,
  HeaderContext,
  PaginationState,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
  StockFeatures,
  Table,
  TableOptions,
  ColumnDef as TanStackColumnDef
} from "@tanstack/svelte-table";

export type ColumnDef<
  TData extends RowData = any,
  TValue = any
> = import("@tanstack/svelte-table").ColumnDef<
  import("@tanstack/svelte-table").StockFeatures,
  TData,
  TValue
>;
