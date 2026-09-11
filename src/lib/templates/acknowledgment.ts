import { PaymentType, type BrandingProfile, type EmailTemplate } from "$lib/types";
import { formatDate } from "$utils/formatters";
import { wrapEmailHtml } from "./base";

export interface AcknowledgmentData {
  accountFullName: string;
  date: string;
  type: string;
  receiptUrl: string;
  seriesNumber: string;
  items?: { name: string; amount: number }[];
}

/**
 * Generates HTML for an Acknowledgment Receipt email.
 */
export function generateAcknowledgmentReceiptHtml(
  data: AcknowledgmentData,
  branding: BrandingProfile
) {
  let typeSpecificText = "";
  const formattedDate = formatDate(data.date);

  // Conditional text logic based on transaction type
  if (data.type === PaymentType.COLLECTION || data.type === PaymentType.COLLECTION_OTHERS) {
    typeSpecificText = `Thank you for your payment last ${formattedDate}. `;
  } else if (data.type === PaymentType.REFUND || data.type === PaymentType.REFUND_COLLECTION) {
    typeSpecificText = `Your payment was refunded. `;
  } else if (data.type === PaymentType.WAIVED) {
    typeSpecificText = `A portion of your semestral fees to the Association has been waived. `;
  } else if (data.type === PaymentType.RECLASSIFY) {
    typeSpecificText = `This is a correction to a previously-issued receipt. `;
  }

  const content = `
  <h2 style="font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 25px; color: #000; display: block;">ACKNOWLEDGMENT RECEIPT</h2>

  <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">Hi, <strong style="font-weight: bold;">${data.accountFullName}</strong></p>

  <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
    ${typeSpecificText}Please find the acknowledgment receipt linked below for your records.
  </p>

  <div style="text-align: center; margin: 35px 0;">
    <a href="${data.receiptUrl}" style="color: #0047AB; font-size: 24px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">VIEW RECEIPT HERE</a>
  </div>

  <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
    We recommend retaining this email for future reference. <strong style="font-weight: bold;">Please verify that the amounts listed on the receipt are correct.</strong> The records will be deemed final one week after you receive this email.
  </p>

  <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
    For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a>.
  </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const AcknowledgmentTemplate: EmailTemplate<AcknowledgmentData> = {
  subject: (data, branding) => `[${branding.shortName}] Receipt PMT-${data.seriesNumber}`,
  generateHtml: generateAcknowledgmentReceiptHtml
};
