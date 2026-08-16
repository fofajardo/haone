import type { RowData } from "@tanstack/svelte-table";

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
