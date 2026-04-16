import { wrapEmailHtml } from "./base";
import { formatDate } from "$lib/receipt-utils";
import type { BrandingProfile, EmailTemplate } from "./types";

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
  if (data.type === "COLLECTION" || data.type === "COLLECTION_OTHERS") {
    typeSpecificText = `Thank you for your payment last ${formattedDate}. `;
  } else if (data.type === "REFUND") {
    typeSpecificText = `Your payment was refunded. `;
  } else if (data.type === "WAIVED") {
    typeSpecificText = `A portion of your semestral fees to the Association has been waived. `;
  } else if (data.type === "RECLASSIFY") {
    typeSpecificText = `This is a correction to a previously-issued receipt. `;
  }

  const content = `
  <h2 class="em-h2">ACKNOWLEDGMENT RECEIPT</h2>

  <p class="em-hi">Hi, <strong>${data.accountFullName}</strong></p>

  <p class="em-p">
    ${typeSpecificText}Please find the acknowledgment receipt linked below for your records.
  </p>

  <div style="text-align: center; margin: 35px 0;">
    <a href="${data.receiptUrl}" class="em-link-btn">VIEW RECEIPT HERE</a>
  </div>

  <p class="em-p">
    We recommend retaining this email for future reference. <strong>Please verify that the amounts listed on the receipt are correct.</strong> The records will be deemed final one week after you receive this email.
  </p>

  <p class="em-p">
    For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:${branding.replyTo}" class="em-link-inline">${branding.replyTo}</a>.
  </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const AcknowledgmentTemplate: EmailTemplate<AcknowledgmentData> = {
  subject: (data, branding) => `Your ${branding.shortName} Receipt PMT-${data.seriesNumber}`,
  generateHtml: generateAcknowledgmentReceiptHtml
};
