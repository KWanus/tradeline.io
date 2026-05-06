import "server-only";

import type { AlertContent } from "./alert-templates";
import type { DeliveryChannel } from "./subscribers";

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

export type DeliveryResult =
  | { kind: "sent"; provider: "resend"; providerMessageId: string }
  | { kind: "preview"; reason: string }
  | { kind: "failed"; error: string };

// Send a single alert via the configured channel. Falls back to "preview"
// (no actual send, but full content returned) when no provider is configured.
export async function deliverAlert(
  channel: DeliveryChannel,
  recipientAddress: string,
  alert: AlertContent
): Promise<DeliveryResult> {
  if (channel === "email") {
    return sendEmailViaResend(recipientAddress, alert);
  }
  if (channel === "slack" || channel === "webhook") {
    return sendWebhook(recipientAddress, alert);
  }
  return { kind: "failed", error: `unknown channel: ${channel}` };
}

async function sendEmailViaResend(
  to: string,
  alert: AlertContent
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      kind: "preview",
      reason:
        "RESEND_API_KEY not set. Alert composed but not sent. Set the env var to enable real delivery.",
    };
  }
  const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;

  // Skip obvious test addresses
  if (to.includes(".example") || to.includes("@example.com")) {
    return {
      kind: "preview",
      reason: `Recipient ${to} looks like a test address. Skipped real send to avoid bounce.`,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: alert.subject,
        html: alert.html,
        text: alert.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        kind: "failed",
        error: `Resend returned ${response.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return {
      kind: "sent",
      provider: "resend",
      providerMessageId: data.id || "",
    };
  } catch (err) {
    return {
      kind: "failed",
      error: (err as Error).message || "fetch failed",
    };
  }
}

async function sendWebhook(
  url: string,
  alert: AlertContent
): Promise<DeliveryResult> {
  if (!url || !url.startsWith("http")) {
    return {
      kind: "preview",
      reason: "Webhook URL missing or invalid. Alert composed but not sent.",
    };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: alert.subject,
        attachments: [
          {
            text: alert.text,
          },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        kind: "failed",
        error: `Webhook returned ${response.status}: ${body.slice(0, 300)}`,
      };
    }
    return {
      kind: "sent",
      provider: "resend",
      providerMessageId: "webhook",
    };
  } catch (err) {
    return {
      kind: "failed",
      error: (err as Error).message || "webhook fetch failed",
    };
  }
}
