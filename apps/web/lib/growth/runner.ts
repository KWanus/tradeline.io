import "server-only";

import { statesForAreaCodes } from "@/lib/geo/area-codes";
import { readUnsubscribed } from "@/lib/report-leads";
import { replyAddressFor } from "@/lib/reply-correlation";
import { readInbox } from "@/lib/replies";
import { EMPTY_SNAPSHOT, readSnapshot, type RadarSnapshot } from "@/lib/snapshot";
import { unsubscribeUrl } from "@/lib/unsubscribe";

import { freeLeadForState } from "./free-lead";

import { composeDrafts, withFooter } from "./compose-llm";
import { discoverProspects } from "./discover-llm";
import {
  leadId,
  readGrowth,
  updateLead,
  upsertLeads,
  type GrowthLead,
} from "./store";

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://tradeline.io"
  );
}

/** Single Resend send. Mirrors lib/autopilot/runner.ts sendEmail. */
export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };
  const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });
    if (!r.ok) {
      return {
        ok: false,
        error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}`,
      };
    }
    const data = (await r.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Operator inbox — the reply fallback when no inbound domain is configured. */
function operatorInbox(): string | undefined {
  return process.env.PROFILE_EMAIL || process.env.REPORT_LEADS_NOTIFY_TO || undefined;
}

/** Inbound voice number to offer in outreach, when configured. */
function callNumber(): string | null {
  return (
    process.env.NEXT_PUBLIC_VOICE_NUMBER?.trim() ||
    process.env.VOICE_NUMBER?.trim() ||
    null
  );
}


/**
 * Reply-To for a growth send. When REPLY_INBOUND_DOMAIN is set we use a
 * correlatable `<leadId>+reply@domain` address so the prospect's reply flows
 * through /api/inbound-reply → the classifier → /app/inbox/replies, unifying
 * sales replies with deal replies in one inbox. Otherwise replies go straight
 * to the operator's inbox.
 */
function growthReplyTo(leadId: string): string | undefined {
  return replyAddressFor(leadId, operatorInbox());
}

/** Ship one queued lead and mark it sent/failed. Used by the approve route. */
export async function sendApprovedLead(
  id: string,
  overrides?: { subject?: string; body?: string }
): Promise<{ ok: boolean; lead?: GrowthLead; error?: string }> {
  const store = await readGrowth();
  const lead = store.leads.find((l) => l.id === id);
  if (!lead) return { ok: false, error: "lead not found" };
  if (lead.status === "sent") return { ok: true, lead };

  // Respect the suppression list at send time too.
  const unsub = await readUnsubscribed();
  if (unsub.has(lead.email.toLowerCase())) {
    const res = await updateLead(id, {
      status: "skipped",
      error: "recipient unsubscribed",
    });
    return { ok: false, lead: res.lead, error: "recipient unsubscribed" };
  }

  const subject = overrides?.subject?.trim() || lead.subject;
  const body = overrides?.body?.trim() || lead.body;

  const sent = await sendEmail({
    to: lead.email,
    subject,
    text: body,
    replyTo: growthReplyTo(lead.id),
  });

  if (!sent.ok) {
    const res = await updateLead(id, { status: "failed", error: sent.error || null, subject, body });
    return { ok: false, lead: res.lead, error: sent.error };
  }
  const nowIso = new Date().toISOString();
  const res = await updateLead(id, {
    status: "sent",
    subject,
    body,
    sentAt: nowIso,
    lastTouchAt: nowIso,
    followUpCount: lead.followUpCount || 0,
    providerMessageId: sent.messageId || null,
    error: null,
  });
  return { ok: true, lead: res.lead };
}

export type DiscoverRunResult = {
  ran: boolean;
  reason?: string;
  found: number;
  queued: number;
  autoSent: number;
  autoFailed: number;
  searched: boolean;
};

/**
 * One discovery cycle: search the web for fresh prospects, draft an email for
 * each, queue them for approval, and — only if config.autoApprove — ship up to
 * dailyCap automatically. Emails the operator a summary either way.
 */
export async function runGrowthDiscovery(): Promise<DiscoverRunResult> {
  const store = await readGrowth();
  const cfg = store.config;
  if (!cfg.enabled) {
    return { ran: false, reason: "growth disabled", found: 0, queued: 0, autoSent: 0, autoFailed: 0, searched: false };
  }
  if (cfg.pausedReason) {
    return { ran: false, reason: cfg.pausedReason, found: 0, queued: 0, autoSent: 0, autoFailed: 0, searched: false };
  }

  // Build the avoid list: everything already in the queue + the suppression list.
  const unsub = await readUnsubscribed();
  const avoid = [
    ...store.leads.map((l) => l.firm),
    ...store.leads.map((l) => l.email),
    ...Array.from(unsub),
  ];

  // Effective target states: explicit picks plus anything mapped from area codes.
  const targetStates = Array.from(
    new Set([...(cfg.states || []), ...statesForAreaCodes(cfg.areaCodes || [])])
  );

  const disc = await discoverProspects({
    segments: cfg.segments,
    geo: cfg.geo,
    target: cfg.dailyDiscoverTarget,
    states: targetStates,
    avoid,
  });
  if (disc.kind === "error") {
    await emailSummary({ error: disc.message });
    return { ran: true, reason: disc.message, found: 0, queued: 0, autoSent: 0, autoFailed: 0, searched: false };
  }

  // Drop anything already known or unsubscribed (defense in depth).
  const have = new Set(store.leads.map((l) => l.id));
  const fresh = disc.leads.filter(
    (l) => !unsub.has(l.email.toLowerCase()) && !have.has(leadId(l.firm, l.email))
  );

  if (fresh.length === 0) {
    await emailSummary({ found: disc.leads.length, queued: 0 });
    return { ran: true, found: disc.leads.length, queued: 0, autoSent: 0, autoFailed: 0, searched: disc.searched };
  }

  // State-matched free lead per prospect (from the live radar; never faked).
  let radar: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    radar = await readSnapshot();
  } catch {}
  const freeLeads = fresh.map((l) => freeLeadForState(radar, l.state));

  const tourUrl = `${siteUrl()}/tour`;
  const composed = await composeDrafts({
    leads: fresh,
    tourUrl,
    senderName: process.env.PROFILE_YOUR_NAME || "",
    senderFirm: process.env.PROFILE_FIRM_NAME || "",
    freeLeads,
    callNumber: callNumber(),
  });
  if (composed.kind === "error") {
    await emailSummary({ error: composed.message });
    return { ran: true, reason: composed.message, found: disc.leads.length, queued: 0, autoSent: 0, autoFailed: 0, searched: disc.searched };
  }

  const now = new Date().toISOString();
  const leads: GrowthLead[] = fresh.map((l, i) => {
    const unsubUrl = unsubscribeUrl(l.email, siteUrl());
    return {
      id: leadId(l.firm, l.email),
      firm: l.firm,
      segment: l.segment,
      contactName: l.contactName,
      email: l.email,
      state: l.state,
      phone: l.phone,
      source: "discovery",
      website: l.website,
      sourceUrl: l.sourceUrl,
      rationale: l.rationale,
      subject: composed.drafts[i].subject,
      body: withFooter(composed.drafts[i].body, unsubUrl),
      status: "pending",
      discoveredAt: now,
      sentAt: null,
      providerMessageId: null,
      error: null,
    };
  });

  const up = await upsertLeads(leads);
  const queued = up.added;

  // Optional fully-autonomous send.
  let autoSent = 0;
  let autoFailed = 0;
  if (cfg.autoApprove && queued > 0) {
    const toSend = leads.slice(0, Math.max(0, cfg.dailyCap));
    for (const lead of toSend) {
      const res = await sendApprovedLead(lead.id);
      if (res.ok) autoSent++;
      else autoFailed++;
    }
  }

  await emailSummary({
    found: disc.leads.length,
    queued,
    autoSent,
    autoFailed,
    autoApprove: cfg.autoApprove,
  });

  return {
    ran: true,
    found: disc.leads.length,
    queued,
    autoSent,
    autoFailed,
    searched: disc.searched,
  };
}

export type FollowupRunResult = {
  ran: boolean;
  reason?: string;
  sent: number;
  failed: number;
  eligible: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** First name from a contact name, for a warmer follow-up open. */
function firstNameOf(contactName: string | null): string {
  const n = (contactName || "").trim().split(/\s+/)[0];
  return n || "there";
}

/**
 * Send polite follow-ups to discovery prospects who got a first email but
 * haven't replied. A lead is "replied" when the inbox holds a reply correlated
 * to its id (bankKey === lead.id). Templated (no LLM) for cost + reliability,
 * with a fresh state-matched free lead and the same CAN-SPAM footer. Respects
 * the suppression list and the per-lead touch cap.
 */
export async function runGrowthFollowups(): Promise<FollowupRunResult> {
  const store = await readGrowth();
  const cfg = store.config;
  if (!cfg.enabled || !cfg.followUpEnabled) {
    return { ran: false, reason: "follow-ups disabled", sent: 0, failed: 0, eligible: 0 };
  }
  if (cfg.pausedReason) {
    return { ran: false, reason: cfg.pausedReason, sent: 0, failed: 0, eligible: 0 };
  }

  const [inbox, unsub] = await Promise.all([readInbox(), readUnsubscribed()]);
  const repliedIds = new Set(
    inbox.map((r) => r.bankKey).filter((k): k is string => !!k)
  );

  const now = Date.now();
  const gapMs = Math.max(1, cfg.followUpGapDays) * DAY_MS;

  const due = store.leads.filter((l) => {
    if (l.source !== "discovery") return false;
    if (l.status !== "sent") return false;
    if (repliedIds.has(l.id)) return false;
    if (unsub.has(l.email.toLowerCase())) return false;
    if ((l.followUpCount || 0) >= cfg.maxFollowUps) return false;
    const last = new Date(l.lastTouchAt || l.sentAt || l.discoveredAt).getTime();
    return Number.isFinite(last) && now - last >= gapMs;
  });

  if (due.length === 0) {
    return { ran: true, sent: 0, failed: 0, eligible: 0 };
  }

  // Oldest touch first; respect the daily cap.
  due.sort(
    (a, b) =>
      new Date(a.lastTouchAt || a.sentAt || 0).getTime() -
      new Date(b.lastTouchAt || b.sentAt || 0).getTime()
  );
  const batch = due.slice(0, Math.max(0, cfg.dailyCap));

  let radar: RadarSnapshot = EMPTY_SNAPSHOT;
  try {
    radar = await readSnapshot();
  } catch {}
  const tourUrl = `${siteUrl()}/tour`;
  const sender = process.env.PROFILE_YOUR_NAME || "The Tradeline team";

  let sent = 0;
  let failed = 0;
  for (const lead of batch) {
    const touch = (lead.followUpCount || 0) + 1;
    const freeLead = freeLeadForState(radar, lead.state);
    const call = callNumber();
    const bodyDraft =
      `Hi ${firstNameOf(lead.contactName)},\n\n` +
      `Circling back on my note about Tradeline — we surface banks and credit unions selling off non-performing loan portfolios, so you know who to call first.\n\n` +
      (freeLead ? `This week's live example: ${freeLead}.\n\n` : "") +
      `Worth a 2-minute look: ${tourUrl}\n\n` +
      (call ? `Prefer to talk? Call ${call}.\n\n` : "") +
      `${sender}`;
    const body = withFooter(bodyDraft, unsubscribeUrl(lead.email, siteUrl()));
    const subject =
      touch === 1
        ? `following up — live NPL sellers worth a look`
        : `last note — a live deal target for ${lead.firm}`;

    const res = await sendEmail({
      to: lead.email,
      subject,
      text: body,
      replyTo: growthReplyTo(lead.id),
    });
    if (res.ok) {
      sent++;
      await updateLead(lead.id, {
        followUpCount: touch,
        lastTouchAt: new Date().toISOString(),
        providerMessageId: res.messageId || lead.providerMessageId,
      });
    } else {
      failed++;
    }
  }

  await emailSummary({ followUps: sent, autoFailed: failed });

  return { ran: true, sent, failed, eligible: due.length };
}

/** Best-effort operator summary email. */
async function emailSummary(args: {
  found?: number;
  queued?: number;
  autoSent?: number;
  autoFailed?: number;
  autoApprove?: boolean;
  followUps?: number;
  error?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO || process.env.PROFILE_EMAIL;
  if (!apiKey || !notifyTo) return;
  const url = siteUrl();

  // Follow-up runs report their own line and skip the discovery framing.
  if (typeof args.followUps === "number") {
    if (args.followUps === 0 && !args.autoFailed) return; // nothing to report
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || RESEND_FROM_DEFAULT,
        to: [notifyTo],
        subject: `[GROWTH] ${args.followUps} follow-up${args.followUps === 1 ? "" : "s"} sent${args.autoFailed ? ` · ${args.autoFailed} failed` : ""}`,
        text: `Tradeline growth · follow-up run\n\nSent: ${args.followUps}\nFailed: ${args.autoFailed || 0}\n\nTrack replies: ${url}/app/inbox/replies`,
      }),
    });
    return;
  }

  const subject = args.error
    ? `[GROWTH] discovery error`
    : args.autoApprove
      ? `[GROWTH] ${args.queued || 0} queued · ${args.autoSent || 0} sent · ${args.autoFailed || 0} failed`
      : `[GROWTH] ${args.queued || 0} new prospects waiting for approval`;

  const lines = args.error
    ? [`Tradeline growth discovery hit an error:`, "", args.error]
    : [
        `Tradeline growth · discovery run`,
        "",
        `Prospects found: ${args.found || 0}`,
        `Newly queued: ${args.queued || 0}`,
        ...(args.autoApprove
          ? [`Auto-sent: ${args.autoSent || 0}`, `Auto-failed: ${args.autoFailed || 0}`]
          : []),
        "",
        args.autoApprove
          ? `Review what went out: ${url}/app/growth`
          : `Approve & send your queue (one tap each): ${url}/app/growth`,
      ];

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || RESEND_FROM_DEFAULT,
      to: [notifyTo],
      subject,
      text: lines.join("\n"),
    }),
  });
}
