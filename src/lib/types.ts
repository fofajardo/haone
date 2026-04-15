export interface PageInfo {
  title: string | null;
}

export interface ReceiptItem {
  name: string;
  amount: number;
}

export interface ReceiptData {
  dateIssued: string;
  paymentDate: string;
  processor: string;
  referenceNumber: string;
  period: string;
  seriesNumber: string;
  receivedFrom: string;
  receivedBy: string;
  notes: string;
  transactionType: string;
  branding: string;
  items: ReceiptItem[];
}
