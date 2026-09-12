import { isSupabase } from "./common";
import type { PaymentRequestServiceInterface } from "./interfaces/payment-request-service.interface";
import { sheetsPaymentRequestService } from "./sheets/payment-request-service";
import { supabasePaymentRequestService } from "./supabase/payment-request-service";

export const paymentRequestService: PaymentRequestServiceInterface = isSupabase
  ? supabasePaymentRequestService
  : sheetsPaymentRequestService;

export * from "./interfaces/payment-request-service.interface";
