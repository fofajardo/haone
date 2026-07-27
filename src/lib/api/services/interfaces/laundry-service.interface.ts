import type { LaundryRecord, PaginationOptions, PaginatedResponse } from "$lib/types";

export interface LaundryServiceInterface {
  fetchReservations(
    residentId?: string,
    options?: PaginationOptions
  ): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>>;

  addReservation(data: Partial<LaundryRecord>): Promise<void>;

  addReservationsBatch(entries: Partial<LaundryRecord>[]): Promise<void>;

  cancelReservation(id: string, reason: string): Promise<void>;
}
