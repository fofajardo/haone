import type {
  JournalRecord,
  PaginatedResponse,
  PaginationOptions,
  PaymentRequestRecord
} from "$lib/types";

export interface PaymentRequestServiceInterface {
  fetchPaymentRequests(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<PaymentRequestRecord[] | PaginatedResponse<PaymentRequestRecord>>;

  addPaymentRequest(data: Partial<PaymentRequestRecord>): Promise<void>;

  approvePaymentRequest(paymentId: string, journalData: Partial<JournalRecord>): Promise<void>;

  declinePaymentRequest(paymentId: string, reason: string): Promise<void>;

  cancelPaymentRequest(id: string): Promise<void>;
}
