import "server-only";

import { readUnsubscribed } from "@/lib/report-leads";
import { unsubscribeUrl } from "@/lib/unsubscribe";

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

/** Where replies land — the operator's inbox. */
function replyToAddress(): string | undefined {
  return process.env.PROFILE_EMAIL || process.env.REPORT_LEADS_NOTIFY_TO || undefined;
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
    replyTo: replyToAddress(),
  });

  if (!sent.ok) {
    const res = await updateLead(id, { status: "failed", error: sent.error || null, subject, body });
    return { ok: false, lead: res.lead, error: sent.error };
  }
  const res = await updateLead(id, {
    status: "sent",
    subject,
    body,
    sentAt: new Date().toISOString(),
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

  const disc = await discoverProspects({
    segments: cfg.segments,
    geo: cfg.geo,
    target: cfg.dailyDiscoverTarget,
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

  const tourUrl = `${siteUrl()}/tour`;
  const composed = await composeDrafts({
    leads: fresh,
    tourUrl,
    senderName: process.env.PROFILE_YOUR_NAME || "",
    senderFirm: process.env.PROFILE_FIRM_NAME || "",
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

/** Best-effort operator summary email. */
async function emailSummary(args: {
  found?: number;
  queued?: number;
  autoSent?: number;
  autoFailed?: number;
  autoApprove?: boolean;
  error?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO || process.env.PROFILE_EMAIL;
  if (!apiKey || !notifyTo) return;
  const url = siteUrl();

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
