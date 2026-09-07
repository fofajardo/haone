import type { BrandingProfile, EmailTemplate } from "$lib/types";
import { wrapEmailHtml } from "./base";

export interface ClearanceEmailData {
  accountName: string;
  ceFullName: string;
  period: string;
  ceLink: string;
  ceRefNo: string;
}

/**
 * Generates HTML for a Clearance Certificate email.
 */
export function generateClearanceHtml(data: ClearanceEmailData, branding: BrandingProfile) {
  const content = `
    <h2 style="font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 25px; color: #000; display: block;">Certificate of Full Payment</h2>

    <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">Hi, <strong style="font-weight: bold;">${data.accountName}</strong></p>
    
    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Your certificate of full payment is now available. This also serves as your clearance from the officers of the Residence Hall Association, which you may present to the dormitory manager when checking out.
    </p>

    <div style="text-align: center; margin: 35px 0;">
      <a href="${data.ceLink}" style="color: #0047AB; font-size: 24px; font-weight: bold; text-decoration: underline; text-transform: uppercase;">VIEW CERTIFICATE HERE</a>
    </div>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      For your security, the link is password-protected. You may open it by entering your student number (e.g., 2001-01234). Kindly reply if you encounter any issues accessing the site.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Reference Number: <span style="font-family: monospace;">${data.ceRefNo}</span>
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; margin-top: 35px;">
      If you have any questions, please feel free to reach out to the officers in person or contact us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a>.
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const ClearanceCertificateTemplate: EmailTemplate<ClearanceEmailData> = {
  subject: (data, branding) => {
    return `[${branding.shortName}] Certificate of Full Payment - ${data.accountName}`;
  },
  generateHtml: generateClearanceHtml
};
