import "server-only";

import { readSnapshot } from "@/lib/snapshot";
import { plainSignal, statusFor, topSignalFor } from "@/lib/signal-copy";
import { resolveContact } from "@/lib/contact-resolver";
import {
  appendLog,
  readState,
  writeState,
  type Audience,
  type AutopilotLogEntry,
  type AutopilotState,
} from "./state";

const RESEND_FROM_DEFAULT = "Tradeline <onboarding@resend.dev>";

export type QueuedItem = {
  bankKey: string;
  bankName: string;
  audience: Audience;
  subject: string;
  text: string;
  signalLabel: string;
};

type RunResult = {
  ranAt: string;
  enabled: boolean;
  paused: string | null;
  dryRun: boolean;
  totalCandidates: number;
  sent: number;
  skippedNoContact: number;
  skippedCap: number;
  failed: number;
  entries: AutopilotLogEntry[];
};

export function buildQueueFromSnapshot(
  snap: Awaited<ReturnType<typeof readSnapshot>>,
  audiences: Audience[]
): QueuedItem[] {
  const items: QueuedItem[] = [];

  if (audiences.includes("sec")) {
    const strong = snap.originators.filter((o) => statusFor(o) === "strong");
    for (const o of strong.slice(0, 3)) {
      const sig = topSignalFor(o.ticker, snap.top_signals);
      const label = sig ? plainSignal(sig.signal_type).label : "Filing activity flagged";
      items.push({
        bankKey: o.ticker,
        bankName: o.name || o.ticker,
        audience: "sec",
        subject: `Q on any ${o.ticker} paper in your inventory`,
        text:
          `Hi,\n\nSaw ${o.name || o.ticker} (${o.ticker}) flag a ${label.toLowerCase()} on our radar this week. ` +
          `If you're seeing any of their portfolio come up for sale — cards, consumer, auto, anything — I'd appreciate being on the inquiry list before it goes wide.\n\n` +
          `Best,\n[YOUR_NAME]\n[FIRM]`,
        signalLabel: label,
      });
    }
  }

  if (audiences.includes("fdic")) {
    const fdic = snap.fdic_signals || [];
    const byCert = new Map<string, (typeof fdic)[number]>();
    for (const s of fdic) {
      const existing = byCert.get(s.cert);
      if (!existing || s.confidence > existing.confidence) byCert.set(s.cert, s);
    }
    const top = Array.from(byCert.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    for (const s of top) {
      items.push({
        bankKey: `fdic-${s.cert}`,
        bankName: s.originator_name,
        audience: "fdic",
        subject: `Buyer inquiry — charged-off consumer paper`,
        text:
          `Hi,\n\nI'm reaching out to ${s.originator_name}'s special-assets / loan-workout team. ` +
          `I'm a [STATE]-licensed debt buyer focused on [ASSET_FOCUS]. If your team sells charged-off paper directly — or works through a broker who does — I'd like to be considered for your inquiry list.\n\n` +
          `Best,\n[YOUR_NAME]\n[FIRM]`,
        signalLabel: s.signal_type === "charge_off_increase" ? "Charge-offs accelerating" : "Noncurrent loans rising",
      });
    }
  }

  if (audiences.includes("ncua")) {
    const ncua = snap.ncua_signals || [];
    const byCert = new Map<string, (typeof ncua)[number]>();
    for (const s of ncua) {
      const existing = byCert.get(s.cert);
      if (!existing || s.confidence > existing.confidence) byCert.set(s.cert, s);
    }
    const top = Array.from(byCert.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    for (const s of top) {
      items.push({
        bankKey: `ncua-${s.cert}`,
        bankName: s.originator_name,
        audience: "ncua",
        subject: `Buyer inquiry — charged-off auto & card paper`,
        text:
          `Hi,\n\nI'm trying to reach ${s.originator_name}'s collections or lending department. ` +
          `I'm a [STATE]-licensed debt buyer focused on [ASSET_FOCUS]. If your credit union sells charged-off paper — directly or through a broker — I'd like to be considered for your buyer list.\n\n` +
          `Best,\n[YOUR_NAME]\n[FIRM]`,
        signalLabel: s.signal_type === "charge_off_increase" ? "Charge-offs accelerating" : "Delinquent loans rising",
      });
    }
  }

  return items;
}

function applyProfile(
  text: string,
  profile: { yourName?: string; firmName?: string; state?: string; assetFocus?: string }
): string {
  return text
    .replace(/\[YOUR_NAME\]/g, profile.yourName || "[YOUR_NAME]")
    .replace(/\[FIRM\]/g, profile.firmName || "[FIRM]")
    .replace(/\[STATE\]/g, profile.state || "[STATE]")
    .replace(/\[ASSET_FOCUS\]/g, profile.assetFocus || "[ASSET_FOCUS]");
}

async function sendEmail(args: {
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
      return { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
    }
    const data = (await r.json()) as { id?: string };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function emailDailySummary(args: {
  state: AutopilotState;
  result: RunResult;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.REPORT_LEADS_NOTIFY_TO;
  if (!apiKey || !notifyTo) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradeline.io";

  const tag = args.result.dryRun ? "[DRY-RUN]" : "[SENT]";
  const subject = `${tag} Autopilot · ${args.result.sent} sent · ${args.result.skippedNoContact} no-contact · ${args.result.failed} failed`;

  const lines: string[] = [
    `Tradeline · autopilot batch · ${args.result.ranAt}`,
    args.result.dryRun ? "(DRY RUN — no emails actually shipped)" : "",
    "",
    `Sent: ${args.result.sent}`,
    `Skipped (no contact resolved): ${args.result.skippedNoContact}`,
    `Skipped (daily cap): ${args.result.skippedCap}`,
    `Failed: ${args.result.failed}`,
    `Daily cap: ${args.state.dailyCap}`,
    "",
    "PER-BANK RESULTS",
    "",
    ...args.result.entries.slice(0, 30).map((e) => {
      const recip = e.recipient || "—";
      return `  ${e.status === "sent" || e.status === "dry-run" ? "✓" : "·"} ${e.bankKey.padEnd(14)} ${e.bankName.slice(0, 30).padEnd(32)} ${recip}  ${e.status}${e.error ? ` (${e.error.slice(0, 60)})` : ""}`;
    }),
    "",
    `Open the workbase: ${siteUrl}/app/today`,
    `Pause autopilot: ${siteUrl}/app/autopilot`,
  ];

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || RESEND_FROM_DEFAULT,
      to: [notifyTo],
      subject,
      text: lines.join("\n"),
    }),
  });
}

/**
 * Main autopilot entry point. Reads state, builds queue, resolves contacts,
 * personalizes drafts (via existing /api/personalize-outreach-equivalent
 * logic inlined here), ships emails, logs everything, emails a summary.
 *
 * Returns a structured result so the cron route can surface stats.
 */
export async function runAutopilot(): Promise<RunResult> {
  const ranAt = new Date().toISOString();
  const state = await readState();

  // Bail-fast guards
  if (!state.enabled) {
    return blankResult(ranAt, state, "not enabled");
  }
  if (state.pausedReason) {
    return blankResult(ranAt, state, `paused: ${state.pausedReason}`);
  }
  // Auto-pause if no login in 7 days.
  if (state.lastLoginAt) {
    const days = (Date.now() - new Date(state.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 7) {
      await writeState({ pausedReason: `auto-paused: no login for ${Math.floor(days)} days` });
      return blankResult(ranAt, state, `auto-paused (${Math.floor(days)}d no login)`);
    }
  }

  // Build queue from snapshot
  let snap;
  try {
    snap = await readSnapshot();
  } catch {
    return blankResult(ranAt, state, "snapshot read failed");
  }

  const queue = buildQueueFromSnapshot(snap, state.audiences);

  // Profile defaults — runner doesn't have access to client localStorage, so
  // we read from env. In v2 this becomes a profile in the data branch.
  const profile = {
    yourName: process.env.PROFILE_YOUR_NAME || "",
    firmName: process.env.PROFILE_FIRM_NAME || "",
    state: process.env.PROFILE_STATE || "",
    assetFocus: process.env.PROFILE_ASSET_FOCUS || "",
  };

  const entries: AutopilotLogEntry[] = [];
  let sent = 0;
  let skippedNoContact = 0;
  let skippedCap = 0;
  let failed = 0;

  for (const item of queue) {
    if (sent >= state.dailyCap) {
      entries.push({
        ts: new Date().toISOString(),
        bankKey: item.bankKey,
        bankName: item.bankName,
        audience: item.audience,
        status: "skipped-cap",
      });
      skippedCap++;
      continue;
    }

    // Resolve contact
    const resolved = await resolveContact({
      bankKey: item.bankKey,
      companyName: item.bankName,
      roleHint:
        "special assets, loan workout, recovery, collections, or charged-off receivables",
    });
    const top = resolved.contacts[0];
    if (!top?.email) {
      entries.push({
        ts: new Date().toISOString(),
        bankKey: item.bankKey,
        bankName: item.bankName,
        audience: item.audience,
        status: "skipped-no-contact",
        error: resolved.reason,
      });
      skippedNoContact++;
      continue;
    }

    // Apply template (custom or default) + profile
    const baseText = state.customTemplate || item.text;
    const finalText = applyProfile(baseText, profile);
    const finalSubject = applyProfile(item.subject, profile);

    // Dry run — log only
    if (state.dryRun) {
      entries.push({
        ts: new Date().toISOString(),
        bankKey: item.bankKey,
        bankName: item.bankName,
        audience: item.audience,
        recipient: top.email,
        subject: finalSubject,
        status: "dry-run",
      });
      sent++; // counts against cap so dry-runs feel like real runs
      continue;
    }

    // Actually send
    const replyTo = process.env.PROFILE_EMAIL || process.env.REPORT_LEADS_NOTIFY_TO;
    const result = await sendEmail({
      to: top.email,
      subject: finalSubject,
      text: finalText,
      replyTo,
    });

    if (result.ok) {
      entries.push({
        ts: new Date().toISOString(),
        bankKey: item.bankKey,
        bankName: item.bankName,
        audience: item.audience,
        recipient: top.email,
        subject: finalSubject,
        status: "sent",
        providerMessageId: result.messageId,
      });
      sent++;
    } else {
      entries.push({
        ts: new Date().toISOString(),
        bankKey: item.bankKey,
        bankName: item.bankName,
        audience: item.audience,
        recipient: top.email,
        subject: finalSubject,
        status: "failed",
        error: result.error,
      });
      failed++;
    }

    // Throttle 1s between sends.
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Persist log + send summary email
  await appendLog(entries);

  const result: RunResult = {
    ranAt,
    enabled: true,
    paused: null,
    dryRun: state.dryRun,
    totalCandidates: queue.length,
    sent,
    skippedNoContact,
    skippedCap,
    failed,
    entries,
  };

  await emailDailySummary({ state, result });

  return result;
}

function blankResult(ranAt: string, state: AutopilotState, reason: string): RunResult {
  return {
    ranAt,
    enabled: state.enabled,
    paused: reason,
    dryRun: state.dryRun,
    totalCandidates: 0,
    sent: 0,
    skippedNoContact: 0,
    skippedCap: 0,
    failed: 0,
    entries: [],
  };
}
