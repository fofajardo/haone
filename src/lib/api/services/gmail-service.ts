import { base64url } from "jose";

/**
 * Gmail API utility functions using Google Identity Services (GIS).
 */

export function loadGisScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script"));
    document.head.appendChild(script);
  });
}

export function loadGapiScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).gapi) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google API Client (gapi)"));
    document.head.appendChild(script);
  });
}

/**
 * Creates an RFC 2822 compliant email message.
 */
export function createEmail(to: string, subject: string, body: string, replyTo?: string) {
  const parts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit"
  ];
  if (replyTo) {
    parts.push(`Reply-To: ${replyTo}`);
  }
  parts.push("", body);
  return base64url.encode(parts.join("\r\n"));
}

/**
 * Sends an email via Gmail API.
 */
export async function sendEmail(accessToken: string, rawMessage: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      raw: rawMessage
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to send email");
  }

  return await response.json();
}
