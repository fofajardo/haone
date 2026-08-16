import { page } from "$app/state";
import { goto } from "$app/navigation";
import type { PaginationState } from "@tanstack/table-core";
import { browser } from "$app/environment";
import { untrack } from "svelte";

/**
 * Utility to synchronize table filters and pagination state with the URL.
 * Supports debounced search and immediate updates for other filters.
 */
export class TableSync<T extends Record<string, any>> {
  filters = $state<T>({} as T);
  pagination = $state<PaginationState>({
    pageIndex: 0,
    pageSize: 20
  });

  #paramMap: Record<keyof T, string>;
  #searchKey: keyof T | null;
  #searchTimeout: any;
  #initialValues: T;
  #defaultPageSize: number;
  #isInitializing = true;

  constructor(options: {
    initialFilters: T;
    paramMap: Record<keyof T, string>;
    searchKey?: keyof T;
    defaultPageSize?: number;
  }) {
    this.#initialValues = options.initialFilters;
    this.#paramMap = options.paramMap;
    this.#searchKey = options.searchKey || null;
    this.#defaultPageSize = options.defaultPageSize || 20;

    const searchParams = page.url.searchParams;
    const initial: any = { ...options.initialFilters };

    for (const [key, param] of Object.entries(this.#paramMap)) {
      const val = searchParams.get(param);
      if (val !== null) {
        initial[key] = val;
      }
    }
    this.filters = initial;

    const p = Number(searchParams.get("page"));
    const s = searchParams.get("size");

    this.pagination.pageIndex = isNaN(p) || p < 1 ? 0 : p - 1;
    this.pagination.pageSize =
      s === "all" ? Number.MAX_SAFE_INTEGER : Number(s) || this.#defaultPageSize;

    $effect(() => {
      const _filt = JSON.stringify(this.filters);
      const _pag = JSON.stringify(this.pagination);

      untrack(() => {
        if (this.#isInitializing) return;
        this.#syncToUrl();
      });
    });

    $effect(() => {
      const _url = page.url.search; // Track entire search string
      untrack(() => {
        this.#syncFromUrl();
        this.#isInitializing = false;
      });
    });
  }

  #syncFromUrl() {
    const searchParams = page.url.searchParams;
    let changed = false;

    const nextFilters = { ...this.filters } as any;
    for (const [key, param] of Object.entries(this.#paramMap)) {
      const val = searchParams.get(param) || this.#initialValues[key];
      if (nextFilters[key] !== val) {
        nextFilters[key] = val;
        changed = true;
      }
    }

    if (changed) {
      this.filters = nextFilters;
    }

    const p = Number(searchParams.get("page"));
    const s = searchParams.get("size");
    const nextPageIndex = isNaN(p) || p < 1 ? 0 : p - 1;
    const nextPageSize = s === "all" ? Number.MAX_SAFE_INTEGER : Number(s) || this.#defaultPageSize;

    if (this.pagination.pageIndex !== nextPageIndex) {
      this.pagination.pageIndex = nextPageIndex;
    }
    if (this.pagination.pageSize !== nextPageSize) {
      this.pagination.pageSize = nextPageSize;
    }
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
          if (
            val !== undefined &&
            val !== null &&
            val !== "" &&
            val !== "ALL" &&
            val !== this.#initialValues[key]
          ) {
            url.searchParams.set(param, val.toString());
          } else {
            url.searchParams.delete(param);
          }
        }

        // Sync Pagination
        const pageVal = (this.pagination.pageIndex + 1).toString();
        const sizeVal =
          this.pagination.pageSize >= 1000000 ? "all" : this.pagination.pageSize.toString();

        if (pageVal !== "1") {
          url.searchParams.set("page", pageVal);
        } else {
          url.searchParams.delete("page");
        }

        if (sizeVal !== this.#defaultPageSize.toString()) {
          url.searchParams.set("size", sizeVal);
        } else {
          url.searchParams.delete("size");
        }

        if (url.searchParams.toString() !== oldQuery) {
          // If non-pagination filters changed, reset page to 1
          const oldParams = new URL(page.url).searchParams;
          const oldFilterString = Array.from(oldParams.entries())
            .filter(([k]) => k !== "page" && k !== "size")
            .sort()
            .join("&");

          const newParams = new URL(url).searchParams;
          const newFilterString = Array.from(newParams.entries())
            .filter(([k]) => k !== "page" && k !== "size")
            .sort()
            .join("&");

          if (oldFilterString !== newFilterString) {
            url.searchParams.delete("page");
            this.pagination.pageIndex = 0;
          }

          goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
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
