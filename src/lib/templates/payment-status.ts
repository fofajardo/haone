import { formatCurrency, formatDate } from "$lib/receipt-utils";

export function generatePaymentStatusHtml(data: {
  accountName: string;
  room: string;
  waterPaid: number;
  waterWaived: number;
  waterBal: number;
  assocPaid: number;
  assocWaived: number;
  assocBal: number;
  paid: number;
  waived: number;
  bal: number;
  isFullyPaid: boolean;
  reminders: string;
  headerImageUrl: string;
  replyTo: string;
}) {
  const dateStr = new Date()
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();

  const fullyPaidSection = data.isFullyPaid
    ? `
    <div style="margin-top: 25px; padding: 15px; border: 1px solid #e2e8f0; background-color: #f8fafc; border-radius: 8px;">
      <p style="font-size: 13px; color: #475569; margin-bottom: 5px;"><strong>Is Certificate of Full Payment Available?</strong></p>
      <p style="font-size: 11px; color: #64748b; line-height: 1.4; margin-bottom: 10px;">
        Clearance from the Residence Hall Association will be issued either upon request or after the last payment that fully settles the account.
      </p>
      <p style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 10px;">YES</p>
      <p style="font-size: 12px; color: #0f172a; line-height: 1.5; font-style: italic;">
        For your security, the PDF file is password-protected. You may open it by entering your student number (e.g., 2001-01234).
      </p>
    </div>
  `
    : `
     <div style="margin-top: 25px; padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px;">
      <p style="font-size: 13px; color: #475569; margin-bottom: 5px;"><strong>Is Certificate of Full Payment Available?</strong></p>
      <p style="font-size: 11px; color: #64748b; line-height: 1.4; margin-bottom: 10px;">
        Clearance from the Residence Hall Association will be issued either upon request or after the last payment that fully settles the account.
      </p>
      <p style="font-size: 13px; font-weight: bold; color: #1e293b;">NO</p>
    </div>
  `;

  const negativeNotice =
    data.bal < 0
      ? `
    <p style="margin-top: 25px; color: #dc2626; font-weight: bold; font-size: 14px; text-transform: uppercase;">
      IMPORTANT: If you see a NEGATIVE OUTSTANDING AMOUNT above, you may be eligible for a refund. Please inquire at Room B105.
    </p>
  `
      : "";

  const semRules = !data.isFullyPaid
    ? `
    <div style="margin-top: 25px; font-size: 13px; line-height: 1.6; color: #334155;">
      <p>We want to kindly remind you that as per Section 19 and Section 25 of the Norms of Conduct and Responsibilities of Residents of the Residence Hall Agreement for this semester:</p>
      <p style="font-style: italic; margin-left: 20px;">19. The resident shall join the residence hall’s online group and will keep constant communication with the dorm staff and student officers...</p>
      <p style="font-style: italic; margin-left: 20px;">25. The resident shall pay a semestral association fee to the Residence Hall Association and other fees (e.g. Water fees, Gas fees, etc.)...</p>
      
      <p style="font-weight: bold; margin-top: 20px;">Association Fee (₱200.00 per semester):</p>
      <ul>
        <li>You may pay just ₱100.00 initially, with the remaining balance due later.</li>
        <li>This fee helps fund events held in the dorm and maintenance of appliances.</li>
      </ul>

      <p style="font-weight: bold; margin-top: 15px;">Water Contribution (₱100.00 per month):</p>
      <ul>
        <li>This will be paid TWICE a month (15th and 30th).</li>
      </ul>
    </div>
  `
    : "";

  return `
<div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; color: #0f172a; line-height: 1.5;">
  <div style="margin-bottom: 25px;">
    <img src="${data.headerImageUrl}" width="100%" alt="Header" style="display: block; border: none;">
  </div>

  <p style="font-size: 16px; margin-bottom: 5px;">Hi, <strong>${data.accountName}</strong> (Room ${data.room})</p>
  <p style="font-size: 14px; color: #475569; margin-bottom: 25px;">Please review your payment status for the current semester below:</p>

  <h3 style="background-color: #000; color: #fff; text-align: center; padding: 10px; font-size: 14px; letter-spacing: 1px; margin-bottom: 0;">PAYMENT STATUS AS OF ${dateStr}</h3>

  <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
    <tr style="background-color: #f8fafc;">
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; font-size: 13px;">Water Fees</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Total Amount Paid</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; text-align: right;">${formatCurrency(data.waterPaid)}</td>
    </tr>
    <tr>
      <td style="padding: 12px; border: 1px solid #e2e8f0;">&nbsp;</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Less: Waived</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: right;">${formatCurrency(data.waterWaived)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="padding: 12px; border: 1px solid #e2e8f0;">&nbsp;</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold;">Outstanding Amount</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; text-align: right;">${formatCurrency(data.waterBal)}</td>
    </tr>

    <tr style="border-top: 2px solid #000;">
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; font-size: 13px;">Association Fee</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Total Amount Paid</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: bold; text-align: right;">${formatCurrency(data.assocPaid)}</td>
    </tr>
    <tr>
      <td style="padding: 12px; border: 1px solid #e2e8f0;">&nbsp;</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Less: Waived</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: right;">${formatCurrency(data.assocWaived)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td style="padding: 12px; border: 1px solid #e2e8f0;">&nbsp;</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold;">Outstanding Amount</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; text-align: right;">${formatCurrency(data.assocBal)}</td>
    </tr>

    <tr style="background-color: #000; color: #fff;">
      <td colspan="3" style="text-align: center; padding: 10px; font-size: 13px; letter-spacing: 1px;">SUMMARY</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold;">Total Amount Paid</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; text-align: right;">${formatCurrency(data.paid)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Less: Waived</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: right;">${formatCurrency(data.waived)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td colspan="2" style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px; font-weight: bold;">Outstanding Amount</td>
      <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 16px; font-weight: bold; text-align: right; color: ${data.bal < 0 ? "#dc2626" : "black"}">${formatCurrency(data.bal)}</td>
    </tr>
  </table>

  ${fullyPaidSection}
  ${negativeNotice}

  <div style="margin-top: 35px; border-top: 1px solid #e2e8f0; pt-25px;">
    <h4 style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #1e293b;">Reminders:</h4>
    <div style="font-size: 13px; line-height: 1.6; color: #334155;">
      ${data.reminders}
    </div>
  </div>

  ${semRules}

  <p style="margin-top: 35px; font-size: 13px; color: #475569;">
    For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:${data.replyTo}" style="color: #0047AB;">${data.replyTo}</a>.
  </p>

  <div style="font-size: 11px; color: #64748b; margin-top: 45px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
    <p style="margin-bottom: 15px;">This is a system-generated message. When responding to this email, please use the reply address provided.</p>
    
    <p style="font-weight: bold; margin-bottom: 5px; color: #475569;">COMMUNICATION CONFIDENTIALITY NOTICE</p>
    <p style="font-style: italic; line-height: 1.4;">
      This message, its thread, and any attachments are privileged, confidential and intended for the specified recipient only. No part of this message may be shared in any form or manner without the consent of the sender. If you are not the intended recipient, please delete this message.
    </p>
  </div>
</div>
  `;
}
