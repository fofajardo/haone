import { paymentRequestService } from "$api/services/payment-request-service";
import type { JournalRecord, PaymentRequestRecord } from "$lib/types";
import { getSignedInUserId } from "./resident-controller";

export async function fetchPaymentRequests(bypassCache = false): Promise<{
  requests: PaymentRequestRecord[];
  currentResidentId: string;
}> {
  const currentResidentId = await getSignedInUserId();
  const res = await paymentRequestService.fetchPaymentRequests(
    currentResidentId,
    undefined,
    bypassCache
  );
  const list = Array.isArray(res) ? res : res.items;
  return {
    requests: list,
    currentResidentId
  };
}

export async function addPaymentRequest(data: Omit<PaymentRequestRecord, "raw">) {
  return await paymentRequestService.addPaymentRequest(data);
}

export async function cancelPaymentRequest(paymentId: string) {
  return await paymentRequestService.cancelPaymentRequest(paymentId);
}

export async function fetchAdminPaymentRequests(
  bypassCache = false
): Promise<PaymentRequestRecord[]> {
  const res = await paymentRequestService.fetchPaymentRequests(undefined, undefined, bypassCache);
  return Array.isArray(res) ? res : res.items;
}

export async function approvePaymentRequest(
  paymentId: string,
  journalData: Partial<JournalRecord>
) {
  await paymentRequestService.approvePaymentRequest(paymentId, journalData);
}

export async function declinePaymentRequest(paymentId: string, reason: string) {
  await paymentRequestService.declinePaymentRequest(paymentId, reason);
}
