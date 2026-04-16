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
    <table class="em-table" style="margin-top: 25px;">
      <tr>
        <td class="em-td ${data.isFullyPaid ? "em-bg-gray" : ""}" style="padding: 15px;">
          <p class="em-h4" style="margin-bottom: 5px;">Is Certificate of Full Payment Available?</p>
          <p class="em-p-small" style="${data.isFullyPaid ? "margin-bottom: 10px;" : ""}">
            Clearance from the Residence Hall Association will be issued either upon request or after the last payment that fully settles the account.
          </p>
          ${
            data.isFullyPaid
              ? `
          <p class="em-p-small em-italic">
            For your security, the PDF file is password-protected. You may open it by entering your student number (e.g., 2001-01234).
          </p>
          `
              : ""
          }
        </td>
        <td class="em-td em-bold" style="padding: 15px; text-align: center; width: 60px;">
          ${data.isFullyPaid ? "YES" : "NO"}
        </td>
      </tr>
    </table>
  `;

  const negativeNotice =
    data.bal < 0
      ? `
    <p class="em-negative">
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
      <ul style="margin-top: 5px;">
        <li>We want to kindly remind you that as per <strong>Section 19</strong> and <strong>Section 25</strong> of the <strong>Norms of Conduct and Responsibilities of Residents</strong> of the Residence Hall Agreement for this semester:</li>
      </ul>
      <blockquote style="margin: 0 0 20px 20px; padding-left: 15px; border-left: 2px solid #eee;">
        <p class="em-p-small em-italic" style="margin-bottom: 10px;">
          19. The resident shall <strong>join the residence hall’s online group</strong> and will keep constant communication with the dorm staff and student officers to get updates and other announcements from pertinent offices, including the dorm management, Office of Student Housing, Office of the Vice Chancellor for Student Affairs, the University Health Service, the University, and the Local Government Unit. 
        </p>
        <br/>
        <p class="em-p-small em-italic">
          25. The resident shall <strong>pay a semestral association fee to the Residence Hall Association and other fees (e.g. Water fees, Gas fees, etc.)</strong> determined and agreed upon by the Association and the hall residents. Non-payment or insufficient payment to the Association will incur an accountability and may be cause for holding the resident’s next dorm application and University clearance until settled.
        </p>
      </blockquote>

      <p class="em-p em-bold" style="margin-top: 20px; text-decoration: underline;">Association Fee (₱200.00 per semester):</p>
      <ul>
        <li>You may pay just ₱100.00 initially, with the remaining balance due later.</li>
        <li>This fee helps fund events held in the dorm (e.g., Open House, PasADAhan), purchase/maintenance of appliances, and other expenses.</li>
      </ul>

      <p class="em-p em-bold" style="margin-top: 15px; text-decoration: underline;">Water Contribution (₱100.00 per month):</p>
      <ul>
        <li>This will be paid <strong>TWICE</strong> a month.</li>
        <li>The first payment of <strong>₱50.00</strong> is due on or before the 15th.</li>
        <li>The remaining <strong>₱50.00</strong> will be collected on the last day or the 30th of the month.</li>
      </ul>
    </div>
  `
    : "";

  const bedNotice = !data.bed
    ? `<br/>
    <div class="em-notice-box">
      <p class="em-notice-h">Action Required</p>
      <p class="em-notice-p">
        Please complete the Semestral Association Member Registration Form immediately.
      </p>
      <div style="margin-top: 15px;">
        <a href="https://tr.ee/ati_sr" class="em-btn-primary">COMPLETE FORM</a>
      </div>
    </div>
  `
    : "";

  const content = `
  <p class="em-hi">Hi, <strong>${data.accountName}</strong> (Room ${data.room})</p>
  
  ${bedNotice}

  <p class="em-p" style="margin-bottom: 25px;">Please review your payment status for the current semester below:</p>

  <h3 class="em-h3 em-bold">PAYMENT STATUS AS OF ${dateStr}</h3>

  <table class="em-table">
    <!-- WATER FEES SECTION -->
    <tr>
      <td rowspan="4" class="em-td em-td-cat">
        <p class="em-bold" style="margin-bottom: 2px;">Water Fees</p>
        <p class="em-p-small em-italic">for the entire semester</p>
      </td>
      <td class="em-td">Billed Amount</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.waterBase)}</td>
    </tr>
    <tr>
      <td class="em-td">Less: Total Amount Paid</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.waterPaid)}</td>
    </tr>
    <tr>
      <td class="em-td">Less: Waived</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.waterWaived)}</td>
    </tr>
    <tr class="em-bg-gray">
      <td class="em-td em-bold">Amount Due</td>
      <td class="em-td em-td-sym em-bold">₱</td>
      <td class="em-td em-td-val em-bold">${formatAmount(data.waterBal)}</td>
    </tr>

    <!-- ASSOCIATION FEE SECTION -->
    <tr class="em-border-top-thick">
      <td rowspan="4" class="em-td em-td-cat">
        <p class="em-bold" style="margin-bottom: 2px;">Association Fee</p>
        <p class="em-p-small em-italic">for the entire semester</p>
      </td>
      <td class="em-td">Billed Amount</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.assocBase)}</td>
    </tr>
    <tr>
      <td class="em-td">Less: Total Amount Paid</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.assocPaid)}</td>
    </tr>
    <tr>
      <td class="em-td">Less: Waived</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.assocWaived)}</td>
    </tr>
    <tr class="em-bg-gray">
      <td class="em-td em-bold">Amount Due</td>
      <td class="em-td em-td-sym em-bold">₱</td>
      <td class="em-td em-td-val em-bold">${formatAmount(data.assocBal)}</td>
    </tr>

    <!-- SUMMARY SECTION -->
    <tr class="em-bg-black">
      <td colspan="4" style="text-align: center; padding: 10px; font-size: 13px; letter-spacing: 1px; font-weight: bold;">SUMMARY</td>
    </tr>
    <tr>
      <td colspan="2" class="em-td">
        <p class="em-bold" style="margin-bottom: 2px;">Billed Amount</p>
        <p class="em-p-tiny">for the entire semester</p>
      </td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val em-bold">${formatAccounting(data.totalBase)}</td>
    </tr>
    <tr>
      <td colspan="2" class="em-td">Less: Total Amount Paid</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.paid)}</td>
    </tr>
    <tr>
      <td colspan="2" class="em-td">Less: Waived</td>
      <td class="em-td em-td-sym"></td>
      <td class="em-td em-td-val">${formatAccounting(data.waived)}</td>
    </tr>
    <tr class="em-bg-gray">
      <td colspan="2" class="em-td em-bold">Outstanding Amount</td>
      <td class="em-td em-td-sym em-bold">₱</td>
      <td class="em-td em-td-val em-bold" style="color: ${data.bal < 0 ? "#dc2626" : "black"};">${formatAmount(data.bal)}</td>
    </tr>
  </table>

  ${fullyPaidSection}

  ${negativeNotice}

  <div style="margin-top: 35px;">
    <p class="em-h4">Reminders:</p>
    
    ${accountSpecificContent}

    <ul>
      <li><strong>Join our Facebook Messenger Community</strong>: <a href="https://tr.ee/ati_fbme" class="em-link-inline">https://tr.ee/ati_fbme</a></li>
      <li><strong>Join our Facebook Group</strong>: <a href="https://www.facebook.com/groups/618203756704972" class="em-link-inline">https://www.facebook.com/groups/618203756704972</a></li>
      <li><strong>Like our Facebook Page</strong>: <a href="https://www.facebook.com/atintcrha.uplb" class="em-link-inline">https://www.facebook.com/atintcrha.uplb</a></li>
      <li>E-receipts for payments made within the week will be issued at the end of each week. You will receive monthly emails similar to this one for balance updates.</li>
      <li>Financial reports of the Association will be shared via Facebook Messenger and the bulletin board at the end of the semester.</li>
    </ul>

    ${sectionRules}

    <p class="em-p em-bold" style="margin-top: 20px; text-decoration: underline;">Payment Options and Considerations:</p>
    <ul>
      <li>Refer to the bulletin board or <a href="https://kawing.pages.dev/ati_payment" class="em-link-inline">this document</a> for payment instructions.</li>
      <li>Residents have the option to pay the full amount upfront.</li>
      <li>Residents experiencing financial difficulties can defer payment by notifying dorm officers.</li>
    </ul>

    <p class="em-p" style="margin-top: 35px;">
      For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:${branding.replyTo}" class="em-link-inline">${branding.replyTo}</a>.
    </p>
  </div>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const PaymentStatusTemplate: EmailTemplate<PaymentStatusData> = {
  subject: (data) => `Payment Status Update: ${data.accountName}`,
  generateHtml: generatePaymentStatusHtml
};
