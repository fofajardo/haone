import { isSupabase } from "./common";
import { sheetsPaymentRequestService } from "./sheets/payment-request-service";
import { supabasePaymentRequestService } from "./supabase/payment-request-service";
import type { PaymentRequestServiceInterface } from "./interfaces/payment-request-service.interface";

export const paymentRequestService: PaymentRequestServiceInterface = isSupabase
  ? supabasePaymentRequestService
  : sheetsPaymentRequestService;

export * from "./interfaces/payment-request-service.interface";
