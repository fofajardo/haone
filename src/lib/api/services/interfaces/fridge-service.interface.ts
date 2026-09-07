import type { FridgeItemRecord, PaginatedResponse, PaginationOptions } from "$lib/types";

export interface FridgeServiceInterface {
  fetchFridgeItems(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<FridgeItemRecord[] | PaginatedResponse<FridgeItemRecord>>;

  addFridgeItem(data: Partial<FridgeItemRecord>): Promise<void>;

  updateFridgeItem(id: string, updates: Partial<FridgeItemRecord>): Promise<void>;

  deleteFridgeItem(id: string, actionBy?: string): Promise<void>;
}
