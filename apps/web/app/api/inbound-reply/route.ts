import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { classifyBrokerReply } from "@/lib/classify-reply-llm";
import { readGrowth } from "@/lib/growth/store";
import { bankKeyFromReplyAddress } from "@/lib/reply-correlation";
import { appendReply, type InboundReply } from "@/lib/replies";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

/**
 * Inbound-reply ingestion — the back half of the outreach loop.
 *
 * Wire your inbound-email provider (Resend Inbound, or any forwarder that POSTs
 * the parsed email as JSON) to this endpoint. For each reply we:
 *   1. correlate it to a bank via the `<bankKey>+reply@` plus-tag,
 *   2. run it through the reply classifier (warm / passing / wants-info / …)
 *      with a pre-drafted response,
 *   3. store it in replies.json (data branch) so it surfaces in /app/inbox/replies
 *      and folds into the Today approval queue,
 *   4. ping the operator.
 *
 * Auth: accepts a valid Resend svix signature (RESEND_WEBHOOK_SECRET) OR a
 * `Bearer <CRON_SECRET>` (for a custom forwarder / manual replay). If neither
 * secret is configured it accepts unsigned posts with a logged warning so a
 * fresh setup can be tested before secrets are wired.
 */

function verifySvix(req: Request, body: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const sigHeader = req.headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;
  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 5 * 60) {
    return false;
  }
  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(keyB64, "base64");
  } catch {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  for (const c of sigHeader.split(" ")) {
    const [, sig] = c.trim().split(",");
    if (!sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

function authorize(req: Request, raw: string): boolean {
  if (verifySvix(req, raw)) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided === cronSecret) return true;
  }
  // Neither secret configured → dev fallback (logged).
  if (!process.env.RESEND_WEBHOOK_SECRET && !process.env.CRON_SECRET) {
    console.warn(
      "[inbound-reply] no RESEND_WEBHOOK_SECRET or CRON_SECRET set — accepting unsigned post."
    );
    return true;
  }
  return false;
}

/** Pull a bare email address out of a raw value or "Name <addr>" or {address}. */
function extractAddress(v: unknown): { email: string; name?: string } {
  if (!v) return { email: "" };
  if (Array.isArray(v)) return extractAddress(v[0]);
  if (typeof v === "object") {
    const o = v as { address?: string; email?: string; name?: string };
    return { email: (o.address || o.email || "").toLowerCase(), name: o.name };
  }
  const s = String(v).trim();
  const angle = s.match(/^(.*?)<([^>]+)>$/);
  if (angle) {
    return { email: angle[2].trim().toLowerCase(), name: angle[1].trim().replace(/^"|"$/g, "") || undefined };
  }
  return { email: s.toLowerCase() };
}

/** Trim a reply body to the new content — drop the most common quote markers. */
function topReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    // Stop at the start of a quoted original ("On <date> ... wrote:" / "-----").
    if (/^On .+wrote:$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message/i.test(line.trim())) break;
    if (/^From:\s.+/i.test(line.trim()) && out.length > 0) break;
    out.push(line);
  }
  // Drop trailing quoted lines (leading ">").
  return out
    .filter((l) => !l.trim().startsWith(">"))
    .join("\n")
    .trim();
}

function stableId(messageId: string, fromEmail: string, receivedAt: string): string {
  const basis = messageId || `${fromEmail}|${receivedAt}`;
  return `r_${crypto.createHash("sha1").update(basis).digest("hex").slice(0, 16)}`;
}

async function notifyOperator(reply: InboundReply) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO || process.env.PROFILE_EMAIL;
  if (!apiKey || !notifyTo) return;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";
  const tag = (reply.classification || "reply").toUpperCase();
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || RESEND_FROM_DEFAULT,
      to: [notifyTo],
      subject: `[REPLY · ${tag}] ${reply.fromName || reply.fromEmail}${reply.bankName ? ` · ${reply.bankName}` : ""}`,
      text:
        `${reply.summary || "New reply received."}\n\n` +
        `From: ${reply.fromName ? `${reply.fromName} ` : ""}<${reply.fromEmail}>\n` +
        (reply.bankName ? `Bank: ${reply.bankName} (${reply.bankKey})\n` : "") +
        `\n— Their message —\n${reply.body.slice(0, 1200)}\n\n` +
        `Approve the drafted reply at ${site}/app/inbox/replies`,
    }),
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!authorize(req, raw)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Tolerate both a flat payload and a Resend-style { type, data } envelope.
  const data = (payload.data as Record<string, unknown>) || payload;

  const fromParsed = extractAddress(data.from);
  const toRaw = data.to as string | string[] | undefined;
  const subject = typeof data.subject === "string" ? data.subject : "";
  const text =
    typeof data.text === "string"
      ? data.text
      : typeof data.html === "string"
        ? (data.html as string).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
        : "";
  const messageId =
    (typeof data.message_id === "string" && data.message_id) ||
    (typeof data.messageId === "string" && data.messageId) ||
    (typeof data.email_id === "string" && data.email_id) ||
    "";

  if (!fromParsed.email || !text.trim()) {
    return NextResponse.json(
      { error: "missing from/text in payload" },
      { status: 400 }
    );
  }

  const receivedAt = new Date().toISOString();
  const bankKey = bankKeyFromReplyAddress(toRaw);
  const body = topReply(text).slice(0, 6000) || text.slice(0, 6000);

  // Resolve a human label for the correlated key. Growth-lead keys ("g_…")
  // resolve to the prospect firm; bank tickers resolve from the snapshot.
  let bankName: string | undefined;
  if (bankKey?.startsWith("g_")) {
    try {
      const store = await readGrowth();
      bankName = store.leads.find((l) => l.id === bankKey)?.firm || undefined;
    } catch {}
  } else if (bankKey) {
    let snap: RadarSnapshot = EMPTY_SNAPSHOT;
    try {
      snap = await readSnapshot();
    } catch {}
    bankName = snap.originators.find((o) => o.ticker === bankKey)?.name || undefined;
  }

  // Build the contexts the classifier expects. Operator profile comes from
  // env (the cron/webhook can't read localStorage).
  const userContext = [
    process.env.PROFILE_YOUR_NAME ? `Name: ${process.env.PROFILE_YOUR_NAME}` : "",
    process.env.PROFILE_FIRM_NAME ? `Firm: ${process.env.PROFILE_FIRM_NAME}` : "",
    process.env.PROFILE_STATE ? `State: ${process.env.PROFILE_STATE}` : "",
    process.env.PROFILE_ASSET_FOCUS ? `Asset focus: ${process.env.PROFILE_ASSET_FOCUS}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const bankContext = bankKey
    ? `Institution: ${bankName || bankKey} (key ${bankKey})`
    : "Institution: unknown (reply did not correlate to a tracked bank)";

  // Classify — best-effort. If the classifier is disabled/errors we still
  // store the raw reply so nothing is lost.
  let classification: InboundReply["classification"];
  let summary: string | undefined;
  let suggestedSubject: string | undefined;
  let suggestedReply: string | undefined;
  try {
    const result = await classifyBrokerReply({ brokerReply: body, userContext, bankContext });
    if (result.kind === "ok") {
      classification = result.data.classification;
      summary = result.data.summary;
      suggestedSubject = result.data.reply_subject;
      suggestedReply = result.data.reply_body;
    }
  } catch {}

  const reply: InboundReply = {
    id: stableId(messageId, fromParsed.email, receivedAt),
    fromEmail: fromParsed.email,
    fromName: fromParsed.name,
    bankKey,
    bankName,
    subject: subject || undefined,
    body,
    receivedAt,
    classification,
    summary,
    suggestedSubject,
    suggestedReply,
  };

  const stored = await appendReply(reply);
  if (!stored.ok) {
    // Storage failed (e.g. GITHUB_PAT missing). Still 200 so the provider
    // doesn't hammer retries, but report the reason.
    console.error("[inbound-reply] store failed:", stored.reason);
    return NextResponse.json(
      { received: true, stored: false, reason: stored.reason },
      { status: 200 }
    );
  }

  if (!stored.duplicate) {
    try {
      await notifyOperator(reply);
    } catch {}
  }

  return NextResponse.json(
    { received: true, stored: true, duplicate: !!stored.duplicate, classification: classification || null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
