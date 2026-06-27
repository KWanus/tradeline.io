import "server-only";

import { SEGMENT_LABELS, upsertLeads, type GrowthLead } from "@/lib/growth/store";
import { freeLeadForState } from "@/lib/growth/free-lead";
import { withFooter } from "@/lib/growth/compose-llm";
import { STATE_NAMES } from "@/lib/geo/area-codes";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { handleTurn, type VoiceSlots } from "@/lib/voice/agent";
import {
  readTwilioForm,
  sendSms,
  twimlGather,
  twimlResponse,
  twimlSayHangup,
  validateTwilioSignature,
} from "@/lib/voice/twilio";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://tradeline.io"
  );
}

function decodeSlots(s: string | null): VoiceSlots {
  if (!s) return {};
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf-8")) as VoiceSlots;
  } catch {
    return {};
  }
}

function encodeSlots(slots: VoiceSlots): string {
  return Buffer.from(JSON.stringify(slots)).toString("base64url");
}

export async function POST(req: Request) {
  const search = new URL(req.url).search; // includes ?s=…
  const params = await readTwilioForm(req);
  if (!validateTwilioSignature(req, params, `/api/voice/turn${search}`)) {
    return new Response("invalid signature", { status: 403 });
  }

  const slots = decodeSlots(new URL(req.url).searchParams.get("s"));
  const speech = params.SpeechResult || "";
  const result = handleTurn(slots, speech);

  if (result.kind === "ask") {
    const action = `/api/voice/turn?s=${encodeSlots(result.slots)}`;
    return twimlResponse(
      twimlGather({ say: result.say, action, reprompt: "Sorry, could you repeat that?" })
    );
  }

  // Completed — deliver the link + log the lead.
  const final = result.slots;
  const phone = params.From || "";
  const say = await deliver(final, phone);
  return twimlResponse(twimlSayHangup(say));
}

async function deliver(slots: VoiceSlots, phone: string): Promise<string> {
  const link = `${siteUrl()}/tour`;
  const where = slots.state ? STATE_NAMES[slots.state] || slots.state : "your area";

  let snap: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    snap = await readSnapshot();
  } catch {}
  const freeLead = freeLeadForState(snap, slots.state || null);
  const leadLine = freeLead ? `Live lead: ${freeLead}. ` : "";

  const digits = phone.replace(/\D/g, "");
  const now = new Date().toISOString();
  const email = slots.email || (digits ? `${digits}@voice.local` : "");

  // Build the lead record. Channel choice drives status.
  let status: GrowthLead["status"] = "pending";
  let providerMessageId: string | null = null;
  let error: string | null = null;
  let confirmation: string;

  if (slots.choice === "text" && phone) {
    const smsBody = `Tradeline: ${leadLine}Start your free trial: ${link}\nReply STOP to opt out.`;
    const sent = await sendSms(phone, smsBody);
    status = sent.ok ? "sent" : "failed";
    error = sent.error || null;
    confirmation = sent.ok
      ? `Done — I just texted your ${where} lead and trial link to this number. Talk soon!`
      : `I had trouble texting you, but you can start now at tradeline dot io slash tour. Thanks for calling!`;
  } else if (slots.choice === "email" && slots.email) {
    // Queue an email for the operator to approve in /app/growth.
    status = "pending";
    confirmation = `Great — we'll email your ${where} lead and trial link to ${slots.email} shortly. Thanks for calling!`;
  } else if (slots.choice === "email" && !slots.email) {
    status = "pending";
    confirmation = `I didn't quite catch that email, but you can start now at tradeline dot io slash tour. We'll follow up. Thanks for calling!`;
  } else {
    // declined
    status = "skipped";
    confirmation = `No problem. If you change your mind, visit tradeline dot io slash tour. Thanks for calling!`;
  }

  const segLabel = slots.segment ? SEGMENT_LABELS[slots.segment] : "caller";
  const subject = "Your Tradeline free lead + trial";
  const bodyDraft =
    `Hi,\n\nThanks for calling Tradeline. Here's the live lead we mentioned:\n` +
    (freeLead ? `• ${freeLead}\n` : "") +
    `\nStart your free trial here: ${link}\n\n${process.env.PROFILE_YOUR_NAME || "The Tradeline team"}`;
  const body = withFooter(bodyDraft, email ? unsubscribeUrl(email, siteUrl()) : null);

  const lead: GrowthLead = {
    id: `g_voice_${digits || Math.abs(hash(now)).toString(36)}`,
    firm: `Inbound caller${slots.state ? ` (${slots.state})` : ""}`,
    segment: slots.segment || "other",
    contactName: null,
    email,
    state: slots.state || null,
    phone: phone || null,
    source: "voice",
    website: null,
    sourceUrl: null,
    rationale: `Inbound call · ${segLabel}${slots.state ? ` · ${slots.state}` : ""} · chose ${slots.choice || "n/a"}.`,
    subject,
    body,
    status,
    discoveredAt: now,
    sentAt: status === "sent" ? now : null,
    providerMessageId,
    error,
  };

  try {
    await upsertLeads([lead]);
  } catch {}

  return confirmation;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
