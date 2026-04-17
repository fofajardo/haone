import { page } from "$app/state";
import { goto } from "$app/navigation";
import type { PaginationState } from "@tanstack/table-core";
import { browser } from "$app/environment";

/**
 * Utility to synchronize table filters and pagination state with the URL.
 * Supports debounced search and immediate updates for other filters.
 */
export class TableSync<T extends Record<string, any>> {
  filters = $state<T>();
  pagination = $state<PaginationState>({
    pageIndex: 0,
    pageSize: 20
  });

  #paramMap: Record<keyof T, string>;
  #searchKey: keyof T | null;
  #searchTimeout: any;
  #initialValues: T;

  constructor(options: {
    initialFilters: T;
    paramMap: Record<keyof T, string>;
    searchKey?: keyof T;
    defaultPageSize?: number;
  }) {
    this.#initialValues = options.initialFilters;
    this.#paramMap = options.paramMap;
    this.#searchKey = options.searchKey || null;

    // Initialize from URL
    const searchParams = page.url.searchParams;
    const initial: any = { ...options.initialFilters };

    for (const [key, param] of Object.entries(this.#paramMap)) {
      const val = searchParams.get(param);
      if (val !== null) {
        initial[key] = val;
      }
    }
    this.filters = initial;

    // Initialize Pagination
    const p = Number(searchParams.get("page"));
    const s = searchParams.get("size");

    this.pagination.pageIndex = isNaN(p) || p < 1 ? 0 : p - 1;
    this.pagination.pageSize =
      s === "all" ? Number.MAX_SAFE_INTEGER : Number(s) || options.defaultPageSize || 20;

    // Setup Sync Effect
    $effect(() => {
      this.#syncToUrl();
    });
  }

  #syncToUrl() {
    if (!browser) return;

    // We use a timeout to debounce search but allow immediate updates for others
    if (this.#searchTimeout) clearTimeout(this.#searchTimeout);

    const q = this.#searchKey ? this.filters![this.#searchKey] : null;
    const isSearchChanging =
      q !== page.url.searchParams.get(this.#paramMap[this.#searchKey!] || "q");

    this.#searchTimeout = setTimeout(
      () => {
        const url = new URL(page.url);
        const oldQuery = url.searchParams.toString();

        // Sync Filters
        for (const [key, param] of Object.entries(this.#paramMap)) {
          const val = this.filters![key];
          if (val && val !== "ALL") {
            url.searchParams.set(param, val.toString());
          } else {
            url.searchParams.delete(param);
          }
        }

        // Sync Pagination
        const pageVal = (this.pagination.pageIndex + 1).toString();
        const sizeVal =
          this.pagination.pageSize >= 1000000 ? "all" : this.pagination.pageSize.toString();

        url.searchParams.set("page", pageVal);
        url.searchParams.set("size", sizeVal);

        if (url.searchParams.toString() !== oldQuery) {
          // If filters changed, reset page to 1
          // (Detection: if old and new params differ beyond just page/size)
          const oldParams = new URLSearchParams(oldQuery);
          oldParams.delete("page");
          oldParams.delete("size");

          const newParams = new URL(url).searchParams;
          newParams.delete("page");
          newParams.delete("size");

          if (oldParams.toString() !== newParams.toString()) {
            url.searchParams.set("page", "1");
            this.pagination.pageIndex = 0;
          }

          goto(url, { replaceState: true, noScroll: true, keepFocus: true });
        }
      },
      isSearchChanging ? 300 : 0
    );
  }

  reset() {
    this.filters = { ...this.#initialValues };
    this.pagination.pageIndex = 0;
  }
}
