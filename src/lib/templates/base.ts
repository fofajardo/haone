export function wrapEmailHtml(content: string, headerImageUrl: string, replyTo: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: sans-serif; color: #000; line-height: 1.5; text-align: left; background-color: #ffffff;">
  <div style="font-family: sans-serif; color: #000; line-height: 1.5; text-align: left; background-color: #ffffff;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px 0;">
      <div style="margin-bottom: 25px;">
        <img src="${headerImageUrl}" alt="Header" style="display: block; width: 100%; height: auto; border: none; margin-bottom: 25px;">
      </div>

      ${content}

      <div style="font-size: 12px; color: #777; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
        <p style="margin-bottom: 15px; font-size: 12px; color: #777; line-height: 1.5;">This is a system-generated message. When responding to this email, please use the reply address provided (this will be done automatically by Gmail or your email client when you select "Reply").</p>
        
        <p style="font-weight: bold; margin-bottom: 5px; color: #555; font-size: 12px;">COMMUNICATION CONFIDENTIALITY NOTICE</p>
        <p style="font-style: italic; line-height: 1.3; margin: 0; font-size: 12px; color: #777;">
          This message, its thread, and any attachments are privileged, confidential and intended for the specified recipient only. No part of this message may be shared in any form or manner without the consent of the sender. If you are not the intended recipient of this message, please inform the sender immediately and delete the message from your inbox.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
