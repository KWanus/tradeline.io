import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    click?: { link?: string };
  };
};

/**
 * Verifies Resend's svix-style webhook signature.
 * Signature format: "v1,<base64(HMAC-SHA256(secret, id.timestamp.body))>"
 * If RESEND_WEBHOOK_SECRET is unset, accepts all (dev-only fallback). Logs a
 * one-line warning so this isn't silently shipped without verification.
 */
function verifySignature(req: Request, body: string): { ok: boolean; reason?: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      "[webhooks/resend] RESEND_WEBHOOK_SECRET not set — accepting unsigned events. Set this in prod."
    );
    return { ok: true };
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const sigHeader = req.headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) {
    return { ok: false, reason: "missing svix headers" };
  }

  // Reject events older than 5 minutes to prevent replays.
  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 5 * 60) {
    return { ok: false, reason: "stale timestamp" };
  }

  // Resend's secret prefix is "whsec_" followed by base64. The HMAC key is
  // the base64-decoded portion after the prefix.
  const keyB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(keyB64, "base64");
  } catch {
    return { ok: false, reason: "bad secret format" };
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  // sigHeader can list multiple "v1,<sig>" entries separated by spaces; any match passes.
  const candidates = sigHeader.split(" ").map((s) => s.trim());
  for (const c of candidates) {
    const [, sig] = c.split(",");
    if (!sig) continue;
    // timingSafeEqual requires equal-length buffers.
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "no signature matched" };
}

async function forwardToOperator(args: {
  notifyTo: string;
  apiKey: string;
  subject: string;
  text: string;
}) {
  const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.notifyTo],
      subject: args.subject,
      text: args.text,
    }),
  });
}

function recipientLabel(d: ResendEvent["data"]): string {
  if (!d?.to) return "(unknown recipient)";
  if (Array.isArray(d.to)) return d.to.join(", ");
  return d.to;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const verification = verifySignature(req, raw);
  if (!verification.ok) {
    return NextResponse.json(
      { error: `signature verification failed: ${verification.reason}` },
      { status: 401 }
    );
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // We only forward operator-visible events. Delivered / opened / clicked are
  // logged for observability but don't generate noise in the operator inbox.
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO;

  const tag =
    event.type === "email.bounced"
      ? "BOUNCE"
      : event.type === "email.complained"
        ? "COMPLAINT"
        : event.type === "email.delivery_delayed"
          ? "DELAYED"
          : null;

  if (tag && apiKey && notifyTo) {
    const to = recipientLabel(event.data);
    const subj = event.data?.subject || "(no subject)";
    const bounceReason =
      event.data?.bounce?.message ||
      event.data?.bounce?.subType ||
      event.data?.bounce?.type ||
      "";
    await forwardToOperator({
      notifyTo,
      apiKey,
      subject: `[${tag}] ${subj} → ${to}`,
      text:
        `Resend event: ${event.type}\n` +
        `At: ${event.created_at || new Date().toISOString()}\n` +
        `To: ${to}\n` +
        `Original subject: ${subj}\n` +
        (bounceReason ? `Reason: ${bounceReason}\n` : "") +
        `\nID: ${event.data?.email_id || "(none)"}\n` +
        `\nIf this was a bank contact saved by /app/today, edit the recipient on the next outreach card or remove it from localStorage (key: tradeline.bank_contacts.v1).`,
    });
  }

  // Resend expects 2xx for successful handling; non-2xx triggers retries.
  return NextResponse.json(
    { received: true, type: event.type },
    { headers: { "Cache-Control": "no-store" } }
  );
}
