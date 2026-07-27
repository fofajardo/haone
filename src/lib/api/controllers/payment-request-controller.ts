import type { PaymentRequestRecord } from "$lib/types";
import { paymentRequestService } from "$api/services/payment-request-service";
import { getCurrentResidentId } from "./resident-controller";

export async function fetchPaymentRequests(_forceRefresh = false): Promise<{
  requests: PaymentRequestRecord[];
  currentResidentId: string;
}> {
  const currentResidentId = await getCurrentResidentId();
  const res = await paymentRequestService.fetchPaymentRequests(currentResidentId);
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
  _forceRefresh = false
): Promise<PaymentRequestRecord[]> {
  const res = await paymentRequestService.fetchPaymentRequests();
  return Array.isArray(res) ? res : res.items;
}

export async function approvePaymentRequest(
  paymentId: string,
  journalData: {
    date: string;
    creator: string;
    account: string;
    water: number;
    assoc: number;
    misc: number;
    mop: string;
    period: string;
    type: string;
    notes: string;
    mopRefNo: string;
    creatorName: string;
    name: string;
    stno: string;
    receiptUrl?: string;
  }
) {
  await paymentRequestService.approvePaymentRequest(paymentId, {
    date: journalData.date,
    creator: journalData.creator,
    account: journalData.account,
    water: journalData.water,
    assoc: journalData.assoc,
    misc: journalData.misc,
    mop: journalData.mop,
    period: journalData.period,
    type: journalData.type,
    notes: journalData.notes,
    mopRefNo: journalData.mopRefNo,
    creatorName: journalData.creatorName,
    name: journalData.name,
    stno: journalData.stno,
    receiptUrl: journalData.receiptUrl
  });
}

export async function declinePaymentRequest(paymentId: string, reason: string) {
  await paymentRequestService.declinePaymentRequest(paymentId, reason);
}
