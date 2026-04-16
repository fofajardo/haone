/**
 * Base template for all emails.
 * Uses aggressive scoping and !important flags to ensure styles work in both previews (no bleed) and final emails.
 */
export function wrapEmailHtml(content: string, headerImageUrl: string, replyTo: string) {
  // UNIQUE ID for scoping in browser previews
  const SCOPE_ID = "haone-email-body";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Global Scoped Styles - Prefixed with #${SCOPE_ID} to prevent UI bleed */
    #${SCOPE_ID} { 
      font-family: sans-serif !important; 
      color: #000 !important; 
      line-height: 1.5 !important; 
      text-align: left !important;
      background-color: #ffffff !important;
    }
    
    /* Container & Layout */
    #${SCOPE_ID} .em-container { max-width: 600px !important; margin: 0 auto !important; padding: 20px 0 !important; }
    #${SCOPE_ID} .em-header-img { display: block !important; width: 100% !important; height: auto !important; border: none !important; margin-bottom: 25px !important; }
    
    /* Typography */
    #${SCOPE_ID} .em-h2 { font-size: 20px !important; font-weight: bold !important; text-transform: uppercase !important; margin-bottom: 25px !important; color: #000 !important; display: block !important; }
    #${SCOPE_ID} .em-h3 { background-color: #000 !important; color: #ffffff !important; text-align: center !important; padding: 10px !important; font-size: 14px !important; letter-spacing: 1px !important; margin: 0 !important; display: block !important; visibility: visible !important; }
    #${SCOPE_ID} .em-h4 { font-size: 14px !important; font-weight: bold !important; margin-bottom: 12px !important; color: #000 !important; display: block !important; }
    #${SCOPE_ID} .em-p { font-size: 14px !important; color: #000 !important; margin-bottom: 20px !important; line-height: 1.5 !important; display: block !important; }
    #${SCOPE_ID} .em-p-small { font-size: 11px !important; color: #000 !important; line-height: 1.4 !important; margin: 0 !important; display: block !important; }
    #${SCOPE_ID} .em-p-tiny { font-size: 10px !important; font-style: italic !important; color: #000 !important; margin: 0 !important; display: block !important; }
    #${SCOPE_ID} .em-bold { font-weight: bold !important; }
    #${SCOPE_ID} .em-italic { font-style: italic !important; }
    #${SCOPE_ID} .em-hi { font-size: 16px !important; margin-bottom: 5px !important; font-weight: normal !important; display: block !important; }
    #${SCOPE_ID} .em-hi strong { font-weight: bold !important; }

    /* Rich Text Elements */
    #${SCOPE_ID} strong, #${SCOPE_ID} b { font-weight: bold !important; }
    #${SCOPE_ID} em, #${SCOPE_ID} i { font-style: italic !important; }
    #${SCOPE_ID} ul, #${SCOPE_ID} ol { 
      margin: 15px 0 15px 0 !important; 
      padding: 0 0 0 35px !important; 
      display: block !important; 
      list-style-position: outside !important;
    }
    #${SCOPE_ID} li { 
      margin-bottom: 10px !important; 
      list-style-type: disc !important; 
      display: list-item !important; 
      line-height: 1.4 !important;
      visibility: visible !important;
    }
    #${SCOPE_ID} a { color: #0047AB !important; text-decoration: underline !important; }

    /* Tables */
    #${SCOPE_ID} .em-table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; visibility: visible !important; display: table !important; }
    #${SCOPE_ID} .em-td { padding: 10px 12px !important; border: 1px solid #000 !important; font-size: 13px !important; vertical-align: middle !important; background-color: transparent !important; }
    #${SCOPE_ID} .em-td-val { text-align: right !important; tabular-nums !important; border-left: none !important; width: 100px !important; }
    #${SCOPE_ID} .em-td-sym { border-right: none !important; width: 25px !important; padding-right: 0 !important; }
    #${SCOPE_ID} .em-td-cat { width: 30% !important; vertical-align: top !important; padding: 12px !important; }
    #${SCOPE_ID} .em-bg-gray { background-color: #f8fafc !important; }
    #${SCOPE_ID} .em-bg-black { background-color: #000 !important; color: #ffffff !important; }
    #${SCOPE_ID} .em-border-top-thick { border-top: 2px solid #000 !important; }

    /* Buttons & Links */
    #${SCOPE_ID} .em-btn-primary { display: inline-block !important; padding: 12px 25px !important; background-color: #dc2626 !important; color: #ffffff !important; text-decoration: none !important; border-radius: 6px !important; font-weight: bold !important; font-size: 14px !important; }
    #${SCOPE_ID} .em-link-btn { color: #0047AB !important; font-size: 24px !important; font-weight: bold !important; text-decoration: underline !important; text-transform: uppercase !important; }
    #${SCOPE_ID} .em-link-inline { color: #0047AB !important; text-decoration: underline !important; }

    /* Specialized Callouts */
    #${SCOPE_ID} .em-notice-box { margin-bottom: 25px !important; padding: 20px !important; border: 2px solid #dc2626 !important; background-color: #fef2f2 !important; border-radius: 8px !important; text-align: center !important; }
    #${SCOPE_ID} .em-notice-h { margin: 0 !important; font-size: 16px !important; font-weight: bold !important; color: #991b1b !important; text-transform: uppercase !important; }
    #${SCOPE_ID} .em-notice-p { margin: 10px 0 !important; font-size: 14px !important; color: #b91c1c !important; line-height: 1.5 !important; }
    #${SCOPE_ID} .em-negative { color: #dc2626 !important; font-weight: bold !important; font-size: 14px !important; text-transform: uppercase !important; margin-top: 25px !important; }

    /* Footer */
    #${SCOPE_ID} .em-footer { font-size: 12px !important; color: #777 !important; margin-top: 40px !important; border-top: 1px solid #eee !important; padding-top: 20px !important; }
    #${SCOPE_ID} .em-footer-h { font-weight: bold !important; margin-bottom: 5px !important; color: #555 !important; }
    #${SCOPE_ID} .em-footer-p { font-style: italic !important; line-height: 1.3 !important; margin: 0 !important; }
  </style>
</head>
<body id="${SCOPE_ID}">
  <!-- This wrapper ID is duplicated here for browser previews that strip body tag -->
  <div id="${SCOPE_ID}">
    <div class="em-container">
      <div style="margin-bottom: 25px;">
        <img src="${headerImageUrl}" class="em-header-img" alt="Header">
      </div>

      ${content}

      <div class="em-footer">
        <p style="margin-bottom: 15px;">This is a system-generated message. When responding to this email, please use the reply address provided (this will be done automatically by Gmail or your email client when you select "Reply").</p>
        
        <p class="em-footer-h">COMMUNICATION CONFIDENTIALITY NOTICE</p>
        <p class="em-footer-p">
          This message, its thread, and any attachments are privileged, confidential and intended for the specified recipient only. No part of this message may be shared in any form or manner without the consent of the sender. If you are not the intended recipient of this message, please inform the sender immediately and delete the message from your inbox.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
