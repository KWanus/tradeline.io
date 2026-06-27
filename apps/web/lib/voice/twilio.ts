import "server-only";

import crypto from "node:crypto";

/**
 * Minimal Twilio helpers — no SDK. Covers request-signature validation, TwiML
 * building/escaping, and outbound SMS via the REST API. Enough to run an
 * inbound voice robot from Next.js route handlers on Vercel (HTTP webhooks,
 * no persistent socket required).
 */

/**
 * Validate Twilio's X-Twilio-Signature for an incoming webhook.
 *
 * Algorithm (Twilio Security docs): take the full request URL exactly as Twilio
 * called it (including query string), append every POST param sorted by key as
 * key+value with no separators, HMAC-SHA1 with the auth token, base64. Compare
 * to the header.
 *
 * The public URL must match what's configured on the Twilio number. Set
 * TWILIO_WEBHOOK_BASE (e.g. https://tradeline.io) to make this deterministic
 * behind Vercel's proxy; otherwise we derive it from forwarded headers.
 *
 * Returns true in dev when TWILIO_AUTH_TOKEN is unset (logged), so the flow can
 * be exercised before secrets are wired.
 */
export function validateTwilioSignature(
  req: Request,
  params: Record<string, string>,
  pathWithQuery: string
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.warn("[voice] TWILIO_AUTH_TOKEN unset — skipping signature check (dev only).");
    return true;
  }
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  const url = fullUrl(req, pathWithQuery);
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];

  const expected = crypto.createHmac("sha1", token).update(data, "utf-8").digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function fullUrl(req: Request, pathWithQuery: string): string {
  const base = process.env.TWILIO_WEBHOOK_BASE?.replace(/\/$/, "");
  if (base) return `${base}${pathWithQuery}`;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return `${proto}://${host}${pathWithQuery}`;
}

/** Escape a string for inclusion in TwiML/XML text. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const VOICE = 'voice="Polly.Joanna"';

/** A `<Say>…</Say><Gather speech>` turn that POSTs back to `action`. */
export function twimlGather(args: {
  say: string;
  action: string;
  /** Optional line spoken if the caller says nothing. */
  reprompt?: string;
}): string {
  const reprompt = args.reprompt
    ? `<Say ${VOICE}>${xmlEscape(args.reprompt)}</Say>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Gather input="speech" speechTimeout="auto" method="POST" actionOnEmptyResult="true" action="${xmlEscape(args.action)}">` +
    `<Say ${VOICE}>${xmlEscape(args.say)}</Say>` +
    `</Gather>` +
    reprompt +
    `</Response>`
  );
}

/** A terminal `<Say>` then hang up. */
export function twimlSayHangup(say: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Say ${VOICE}>${xmlEscape(say)}</Say><Hangup/></Response>`
  );
}

export function twimlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Send an SMS via the Twilio REST API. Best-effort; returns ok/error. */
export async function sendSms(
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio SMS env not set (TWILIO_ACCOUNT_SID/AUTH_TOKEN/NUMBER)" };
  }
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({ To: to, From: from, Body: body });
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );
    if (!r.ok) {
      return { ok: false, error: `Twilio ${r.status}: ${(await r.text()).slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Parse the urlencoded Twilio webhook body into a flat string map. */
export async function readTwilioForm(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}
