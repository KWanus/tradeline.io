import "server-only";

import { NextResponse } from "next/server";

import { classifyBrokerReply } from "@/lib/classify-reply-llm";
import { parseInboundAddress } from "@/lib/reply-correlation";
import { appendReplyServer, type ReplyIntent } from "@/lib/replies";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * Resend inbound-email webhook handler (PLAN P1-2).
 *
 * Wire-up: point an inbound route in the Resend dashboard at this endpoint and
 * set RESEND_INBOUND_SECRET. Resend POSTs the parsed email; we classify it,
 * correlate it back to a bank via the plus-tagged recipient, and append it to
 * the reply inbox on the data branch so it surfaces as a Today card.
 *
 * Until the domain + webhook are configured this route is dormant — but it's
 * fully written so flipping it on is an env-var change, not a code change.
 */

/** Collapse the richer LLM taxonomy into the four buckets the inbox acts on. */
function toIntent(classification: string, body: string): ReplyIntent {
  if (/\bunsubscribe\b|\bremove me\b|\bstop emailing\b|\bopt out\b/i.test(body)) {
    return "unsubscribe";
  }
  switch (classification) {
    case "warm":
      return "interested";
    case "has-tape":
      return "has_tape";
    case "wants-info":
    case "tape-detail-request":
    case "needs-license":
      return "wants_info";
    case "passing":
    case "panel-only":
      return "passing";
    default:
      return "unclear";
  }
}

type ResendInbound = {
  type?: string;
  data?: {
    from?: string | { address?: string; name?: string };
    subject?: string;
    text?: string;
    html?: string;
    to?: Array<string | { address?: string }> | string;
  };
  // Some payloads put fields at the top level.
  from?: string;
  subject?: string;
  text?: string;
  to?: string;
};

function asAddress(v: unknown): { email: string; name?: string } {
  if (typeof v === "string") {
    // "Name <email>" or bare "email"
    const m = v.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (m) return { email: m[2].trim(), name: m[1].trim() || undefined };
    return { email: v.trim() };
  }
  if (v && typeof v === "object") {
    const o = v as { address?: string; email?: string; name?: string };
    return { email: (o.address || o.email || "").trim(), name: o.name };
  }
  return { email: "" };
}

function firstRecipient(to: unknown): string {
  if (typeof to === "string") return to;
  if (Array.isArray(to) && to.length > 0) return asAddress(to[0]).email;
  return "";
}

export async function POST(req: Request) {
  // Shared-secret gate. Resend signs with Svix; for the lightweight self-hosted
  // path we accept a static secret header. When the secret is unset the route
  // refuses outright so it can't be abused as an open reply injector.
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "inbound disabled — set RESEND_INBOUND_SECRET" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const provided =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("x-resend-secret") ||
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ResendInbound;
  try {
    body = (await req.json()) as ResendInbound;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const data = body.data ?? body;
  const fromAddr = asAddress(data.from ?? body.from);
  const text = (data.text || body.text || "").toString().slice(0, 6000);
  const subject = (data.subject || body.subject || "").toString().slice(0, 300);
  const toRaw = (data as { to?: unknown }).to ?? body.to;
  const recipient = firstRecipient(toRaw);
  const { bankKey } = parseInboundAddress(recipient);

  if (!fromAddr.email || !text.trim()) {
    return NextResponse.json(
      { error: "missing from/text" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Classify (best-effort). If ANTHROPIC_API_KEY is absent we still record the
  // reply with an "unclear" intent so it isn't lost — the operator can read it.
  let intent: ReplyIntent = "unclear";
  try {
    const result = await classifyBrokerReply({
      brokerReply: text,
      userContext: "",
      bankContext: bankKey ? `bankKey: ${bankKey}` : "",
    });
    if (result.kind === "ok") {
      intent = toIntent(result.data.classification, text);
    } else {
      intent = toIntent("", text); // still catches unsubscribe keywords
    }
  } catch {
    intent = toIntent("", text);
  }

  const append = await appendReplyServer({
    from: fromAddr.email,
    fromName: fromAddr.name,
    subject: subject || undefined,
    body: text,
    intent,
    bankKey: bankKey || undefined,
    receivedAt: new Date().toISOString(),
  });

  // Always 200 so the provider doesn't retry-storm us on a transient GitHub
  // outage. The `stored` flag tells an operator inspecting logs what happened.
  return NextResponse.json(
    { ok: true, stored: append.ok, intent, bankKey: bankKey || null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
