import type { LaundryRecord, PaginatedResponse, PaginationOptions } from "$lib/types";

export interface LaundryServiceInterface {
  fetchReservations(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>>;

  addReservation(data: Partial<LaundryRecord>): Promise<void>;

  addReservationsBatch(entries: Partial<LaundryRecord>[]): Promise<void>;

  cancelReservation(id: string, reason: string): Promise<void>;
}
