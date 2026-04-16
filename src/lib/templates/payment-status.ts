import { formatAccounting, formatAmount } from "$lib/receipt-utils";
import { wrapEmailHtml } from "./base";
import type { BrandingProfile, EmailTemplate } from "./types";

export interface PaymentStatusData {
  accountName: string;
  room: string;
  bed: string;
  waterBase: number;
  waterPaid: number;
  waterWaived: number;
  waterBal: number;
  assocBase: number;
  assocPaid: number;
  assocWaived: number;
  assocBal: number;
  totalBase: number;
  paid: number;
  waived: number;
  bal: number;
  isFullyPaid: boolean;
  reminders: string;
}

/**
 * Generates HTML for a Payment Status Update email.
 */
export function generatePaymentStatusHtml(data: PaymentStatusData, branding: BrandingProfile) {
  const dateStr = new Date()
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();

  const fullyPaidSection = `
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 25px;">
      <tr>
        <td style="padding: 15px; border: 1px solid #000; font-size: 13px; vertical-align: middle; ${data.isFullyPaid ? "background-color: #f8fafc;" : ""}">
          <p style="font-size: 14px; font-weight: bold; margin-bottom: 5px; color: #000; display: block;">Is Certificate of Full Payment Available?</p>
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; ${data.isFullyPaid ? "margin-bottom: 10px;" : ""}">
            Clearance from the Residence Hall Association will be issued either upon request or after the last payment that fully settles the account.
          </p>
          ${
            data.isFullyPaid
              ? `
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">
            For your security, the PDF file is password-protected. You may open it by entering your student number (e.g., 2001-01234).
          </p>
          `
              : ""
          }
        </td>
        <td style="padding: 15px; text-align: center; width: 60px; border: 1px solid #000; font-size: 13px; font-weight: bold; vertical-align: middle;">
          ${data.isFullyPaid ? "YES" : "NO"}
        </td>
      </tr>
    </table>
  `;

  const negativeNotice =
    data.bal < 0
      ? `
    <p style="color: #dc2626; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-top: 25px; display: block;">
      IMPORTANT: If you see a NEGATIVE OUTSTANDING AMOUNT above, you may be eligible for a refund. Please inquire at Room B105.
    </p>
  `
      : "";

  const accountSpecificContent = data.reminders
    ? `
    <div style="margin-bottom: 25px; font-size: 14px;">
      ${data.reminders}
    </div>
  `
    : "";

  const sectionRules = !data.isFullyPaid
    ? `
    <div style="margin-top: 25px;">
      <ul style="margin-top: 5px; margin-bottom: 15px; padding: 0 0 0 35px; list-style-position: outside;">
        <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px;">We want to kindly remind you that as per <strong>Section 19</strong> and <strong>Section 25</strong> of the <strong>Norms of Conduct and Responsibilities of Residents</strong> of the Residence Hall Agreement for this semester:</li>
      </ul>
      <blockquote style="margin: 0 0 20px 20px; padding-left: 15px; border-left: 2px solid #eee;">
        <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; margin-bottom: 10px; font-style: italic;">
          19. The resident shall <strong>join the residence hall’s online group</strong> and will keep constant communication with the dorm staff and student officers to get updates and other announcements from pertinent offices, including the dorm management, Office of Student Housing, Office of the Vice Chancellor for Student Affairs, the University Health Service, the University, and the Local Government Unit. 
        </p>
        <br/>
        <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">
          25. The resident shall <strong>pay a semestral association fee to the Residence Hall Association and other fees (e.g. Water fees, Gas fees, etc.)</strong> determined and agreed upon by the Association and the hall residents. Non-payment or insufficient payment to the Association will incur an accountability and may be cause for holding the resident’s next dorm application and University clearance until settled.
        </p>
      </blockquote>

      <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; font-weight: bold; margin-top: 20px; text-decoration: underline;">Association Fee (₱200.00 per semester):</p>
      <ul style="margin: 15px 0 15px 0; padding: 0 0 0 35px; list-style-position: outside;">
        <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px;">You may pay just ₱100.00 initially, with the remaining balance due later.</li>
        <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px;">This fee helps fund events held in the dorm (e.g., Open House, PasADAhan), purchase/maintenance of appliances, and other expenses.</li>
      </ul>

      <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; font-weight: bold; margin-top: 15px; text-decoration: underline;">Water Contribution (₱100.00 per month):</p>
      <ul style="margin: 15px 0 15px 0; padding: 0 0 0 35px; list-style-position: outside;">
        <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px;">This will be paid <strong>TWICE</strong> a month.</li>
        <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px;">The first payment of <strong>₱50.00</strong> is due on or before the 15th.</li>
        <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px;">The remaining <strong>₱50.00</strong> will be collected on the last day or the 30th of the month.</li>
      </ul>
    </div>
  `
    : "";

  const bedNotice = !data.bed
    ? `<br/>
    <div style="margin-bottom: 25px; padding: 20px; border: 2px solid #dc2626; background-color: #fef2f2; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: bold; color: #991b1b; text-transform: uppercase;">Action Required</p>
      <p style="margin: 10px 0; font-size: 14px; color: #b91c1c; line-height: 1.5;">
        Please complete the Semestral Association Member Registration Form immediately.
      </p>
      <div style="margin-top: 15px;">
        <a href="https://tr.ee/ati_sr" style="display: inline-block; padding: 12px 25px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">COMPLETE FORM</a>
      </div>
    </div>`
    : "";

  const content = `
  <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">Hi, <strong style="font-weight: bold;">${data.accountName}</strong> (Room ${data.room})</p>
  
  ${bedNotice}

  <p style="font-size: 14px; color: #000; margin-bottom: 25px; line-height: 1.5; display: block;">Please review your payment status for the current semester below:</p>

  <h3 style="background-color: #000; color: #ffffff; text-align: center; padding: 10px; font-size: 14px; letter-spacing: 1px; margin: 0; display: block; font-weight: bold;">PAYMENT STATUS AS OF ${dateStr}</h3>

  <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; display: table;">
    <!-- WATER FEES SECTION -->
    <tr>
      <td rowspan="4" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
        <p style="font-weight: bold; margin-bottom: 2px;">Water Fees</p>
        <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">for the entire semester</p>
      </td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Billed Amount</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.waterBase)}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.waterPaid)}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.waterWaived)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Amount Due</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">\${formatAmount(data.waterBal)}</td>
    </tr>

    <!-- ASSOCIATION FEE SECTION -->
    <tr style="border-top: 2px solid #000;">
      <td rowspan="4" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
        <p style="font-weight: bold; margin-bottom: 2px;">Association Fee</p>
        <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">for the entire semester</p>
      </td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Billed Amount</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.assocBase)}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.assocPaid)}</td>
    </tr>
    <tr>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.assocWaived)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Amount Due</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">\${formatAmount(data.assocBal)}</td>
    </tr>

    <!-- SUMMARY SECTION -->
    <tr style="background-color: #000; color: #ffffff;">
      <td colspan="4" style="text-align: center; padding: 10px; font-size: 13px; letter-spacing: 1px; font-weight: bold;">SUMMARY</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">
        <p style="font-weight: bold; margin-bottom: 2px;">Billed Amount</p>
        <p style="font-size: 10px; font-style: italic; color: #000; margin: 0;">for the entire semester</p>
      </td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">\${formatAccounting(data.totalBase)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.paid)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">\${formatAccounting(data.waived)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Outstanding Amount</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
      <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold; color: \${data.bal < 0 ? "#dc2626" : "black"};">\${formatAmount(data.bal)}</td>
    </tr>
  </table>

  \${fullyPaidSection}

  \${negativeNotice}

  <div style="margin-top: 35px;">
    <p style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #000; display: block;">Reminders:</p>
    
    \${accountSpecificContent}

    <ul style="margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside;">
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;"><strong style="font-weight: bold;">Join our Facebook Messenger Community</strong>: <a href="https://tr.ee/ati_fbme" style="color: #0047AB; text-decoration: underline;">https://tr.ee/ati_fbme</a></li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;"><strong style="font-weight: bold;">Join our Facebook Group</strong>: <a href="https://www.facebook.com/groups/618203756704972" style="color: #0047AB; text-decoration: underline;">https://www.facebook.com/groups/618203756704972</a></li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;"><strong style="font-weight: bold;">Like our Facebook Page</strong>: <a href="https://www.facebook.com/atintcrha.uplb" style="color: #0047AB; text-decoration: underline;">https://www.facebook.com/atintcrha.uplb</a></li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">E-receipts for payments made within the week will be issued at the end of each week. You will receive monthly emails similar to this one for balance updates.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Financial reports of the Association will be shared via Facebook Messenger and the bulletin board at the end of the semester.</li>
    </ul>

    \${sectionRules}

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; font-weight: bold; margin-top: 20px; text-decoration: underline;">Payment Options and Considerations:</p>
    <ul style="margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside;">
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Refer to the bulletin board or <a href="https://kawing.pages.dev/ati_payment" style="color: #0047AB; text-decoration: underline;">this document</a> for payment instructions.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Residents have the option to pay the full amount upfront.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Residents experiencing financial difficulties can defer payment by notifying dorm officers.</li>
    </ul>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; margin-top: 35px;">
      For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:\${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">\${branding.replyTo}</a>.
    </p>
  </div>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const PaymentStatusTemplate: EmailTemplate<PaymentStatusData> = {
  subject: (data) => `Payment Status Update: \${data.accountName}`,
  generateHtml: generatePaymentStatusHtml
};
