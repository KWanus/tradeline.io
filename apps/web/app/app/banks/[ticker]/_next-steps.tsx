"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type BuyerProfile,
  buildBuyerProfileSheet,
  fillTemplate,
  isProfileComplete,
  useBuyerProfile,
} from "@/lib/buyer-profile";
import {
  logOutreach,
  useIsWatchlisted,
  useOutreachForTicker,
} from "@/lib/bank-state";
import { dealForTicker, upsertDealForBank } from "@/lib/pipeline";
import {
  CelebrationToast,
  MilestoneBanner,
  SparkleBurst,
  useDoneCelebration,
} from "../../_components/celebrate";

const STEPS_KEY_PREFIX = "tradeline.bank_playbook_steps.";

function formatPipelineAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function inferAssetClass(bankName: string): string {
  const n = bankName.toLowerCase();
  if (/mortgage|residential|home/.test(n)) return "Junior mortgage";
  if (/auto|vehicle|drive/.test(n)) return "Auto";
  if (/medical|health/.test(n)) return "Medical";
  return "Credit card";
}

type BrokerRec = {
  shortName: string;
  name: string;
  url: string;
  contactPath: string;
  why: string;
};

type Outcome = {
  id: string;
  trigger: string;
  yourMove: string;
  responseSubject?: string;
  responseBody: string;
  nextAction?: { label: string; href: string };
};

type Props = {
  ticker: string;
  bankName: string;
  signalLabel: string;
  signalAction: string;
  yoyPct?: number;
  recommendedBrokers: BrokerRec[];
  status: "strong" | "watching" | "quiet";
};

function buildOutreachEmail(
  p: BuyerProfile,
  ctx: { ticker: string; bankName: string; signalLabel: string; yoyPct?: number }
) {
  const subject = fillTemplate("[STATE] licensed buyer — interest in [TICKER] paper", p, ctx);
  const body = fillTemplate(
    `Hi [name],

I've been watching [BANK] ([TICKER]) — their [SIGNAL] is [YOY] as of their latest filing. If they put paper out in the next 1–2 quarters, I'd want a look.

Quick on us:
- [STATE]-licensed debt buyer · license [LICENSE] · [BOND_CARRIER] bond at [BOND_AMOUNT]
- Focus: [ASSET_FOCUS]
- Average ticket: [TICKET]
- Servicing through: [SERVICER]

If [TICKER] hasn't been on your bench, also interested in similar mid-market regional paper. Looking for a relationship, not just one trade.

Best,
[YOUR_NAME]
[PHONE] · [EMAIL]
License [LICENSE]`,
    p,
    ctx
  );
  return { subject, body };
}

const OUTCOME_DEFS = (
  p: BuyerProfile,
  ctx: { ticker: string; bankName: string; signalLabel: string; yoyPct?: number }
): Outcome[] => [
  {
    id: "send-profile",
    trigger: '"Send me your buyer profile."',
    yourMove: "Reply with the one-page profile. They want to vet you before sending tape.",
    responseSubject: fillTemplate("Buyer profile — [FIRM]", p, ctx),
    responseBody: fillTemplate(
      `Hi [name], attached / pasted below.

${buildBuyerProfileSheet(p)}

Happy to jump on a 15-minute call. Best times this week: [your times].

[YOUR_NAME]`,
      p,
      ctx
    ),
  },
  {
    id: "no-current-paper",
    trigger: '"I don\'t have current paper from them."',
    yourMove: "Stay on the list. Broaden the ask so you stay top-of-mind.",
    responseSubject: fillTemplate("Re: [TICKER] — also interested in similar paper", p, ctx),
    responseBody: fillTemplate(
      `Understood. If [TICKER] does come up, please flag.

Also interested in similar mid-market regional [ASSET_FOCUS] paper, ticket [TICKET], 6–24 month vintage. Happy to be on your regular distribution.

Thanks,
[YOUR_NAME]`,
      p,
      ctx
    ),
  },
  {
    id: "panel-only",
    trigger: '"We only deal with panel buyers."',
    yourMove: "Ask the path to panel. Start small to build the file.",
    responseSubject: fillTemplate("Path to panel — [FIRM]", p, ctx),
    responseBody: fillTemplate(
      `Totally fair. What's the path to your panel?

Happy to start on a small ticket to build the file. Three things working for me: license + bond ready, [SERVICER] servicing set up, will wire on contract execution. Whatever you can give me on a first deal, I'll close clean.

Best,
[YOUR_NAME]`,
      p,
      ctx
    ),
  },
  {
    id: "need-license",
    trigger: '"Send me your state license."',
    yourMove: "Attach the license PDF + bond letter. Reference the numbers in the body so they can verify before opening attachments.",
    responseSubject: fillTemplate("[STATE] license + bond — [FIRM]", p, ctx),
    responseBody: fillTemplate(
      `Hi [name], attached:
- [STATE] debt-buyer license, # [LICENSE]
- [BOND_CARRIER] surety bond, $[BOND_AMOUNT]
- Servicer agreement summary with [SERVICER]

Verify the license via [State]'s public licensee search. Reach out if anything's missing.

[YOUR_NAME]
[PHONE]`,
      p,
      ctx
    ),
    nextAction: { label: "Find your license on /app/compliance", href: "/app/compliance" },
  },
  {
    id: "tape-incoming",
    trigger: '"Here\'s a tape — what\'s your bid?"',
    yourMove: "Drop the CSV into the tape copilot, then run the bid calculator, then send a bid email.",
    responseBody: "Don't bid until you've run the tape through the copilot. Click the next-action button to start.",
    nextAction: { label: "Open Tape Copilot →", href: "/app/tools/tape" },
  },
  {
    id: "no-reply-7d",
    trigger: "No reply after 7 days.",
    yourMove: "One follow-up. Short, references new context if any.",
    responseSubject: fillTemplate("Following up — [TICKER]", p, ctx),
    responseBody: fillTemplate(
      `Hi [name], circling back on [BANK].

Their [SIGNAL] is still showing in the latest filing. If they do divest in the next quarter, I'm interested. Have 15 minutes for a quick call this week?

[YOUR_NAME]`,
      p,
      ctx
    ),
  },
  {
    id: "no-reply-14d",
    trigger: "No reply after 14 days.",
    yourMove: "Stop chasing. Mark broker cold. Try one of the alternate brokers from the recommendations panel.",
    responseBody: "Don't send a third email — you'll burn the relationship. Note the broker as cold in your Pipeline and try another.",
    nextAction: { label: "Add to Pipeline →", href: "/app/pipeline" },
  },
];

export function NextStepsPanel({
  ticker,
  bankName,
  signalLabel,
  signalAction,
  yoyPct,
  recommendedBrokers,
  status,
}: Props) {
  const [profile, saveProfile] = useBuyerProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [steps, setSteps] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedOutcome, setExpandedOutcome] = useState<string | null>(null);
  const [pickBrokerFor, setPickBrokerFor] = useState<"copy" | "mailto" | "send" | null>(null);
  const [pipelineToast, setPipelineToast] = useState<string | null>(null);
  const [milestoneSeen, setMilestoneSeen] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<
    | { kind: "ok"; broker: string; messageId: string; reminderCount: number }
    | { kind: "error"; message: string }
    | { kind: "disabled" }
    | null
  >(null);
  const celebration = useDoneCelebration();
  const outreachEvents = useOutreachForTicker(ticker);
  const [watchlisted, toggleWatch] = useIsWatchlisted(ticker);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STEPS_KEY_PREFIX + ticker);
      if (raw) setSteps(JSON.parse(raw));
    } catch {}
  }, [ticker]);

  const toggleStep = (id: string) => {
    const becameDone = !steps[id];
    const next = { ...steps, [id]: !steps[id] };
    setSteps(next);
    try {
      window.localStorage.setItem(STEPS_KEY_PREFIX + ticker, JSON.stringify(next));
    } catch {}
    if (becameDone) {
      const stepLabels: Record<string, string> = {
        profile: "Profile filled",
        emails: "Outreach sent",
        pipeline: "Added to Pipeline",
        tutor: "Tutor rehearsed",
      };
      celebration.trigger(id, `Done · ${stepLabels[id] || "Step"}`);
    }
  };

  const ctx = { ticker, bankName, signalLabel, yoyPct };
  const outreach = useMemo(() => buildOutreachEmail(profile, ctx), [profile, ticker, bankName, signalLabel, yoyPct]);
  const profileSheet = useMemo(() => buildBuyerProfileSheet(profile), [profile]);
  const outcomes = useMemo(() => OUTCOME_DEFS(profile, ctx), [profile, ticker, bankName, signalLabel, yoyPct]);

  // Auto-expand the relevant "no reply" outcome based on elapsed days since outreach.
  const latestDays = useMemo(() => {
    if (outreachEvents.length === 0) return null;
    const latest = outreachEvents.reduce((a, b) => (a.sentAt > b.sentAt ? a : b));
    return Math.floor((Date.now() - new Date(latest.sentAt).getTime()) / (1000 * 60 * 60 * 24));
  }, [outreachEvents]);
  const suggestedOutcome =
    latestDays === null ? null : latestDays >= 14 ? "no-reply-14d" : latestDays >= 7 ? "no-reply-7d" : null;
  useEffect(() => {
    if (suggestedOutcome && !expandedOutcome) {
      setExpandedOutcome(suggestedOutcome);
    }
  }, [suggestedOutcome, expandedOutcome]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  };

  const profileComplete = isProfileComplete(profile);

  if (status === "quiet") {
    return (
      <section className="mb-10 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
          This bank is quiet today
        </div>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
          No strong signal — don&rsquo;t cold-email a broker about this bank yet.
          Bookmark it and check back when it turns yellow or green on{" "}
          <Link href="/app/banks" className="text-[color:var(--color-accent)] hover:underline">
            the radar
          </Link>
          .
        </p>
      </section>
    );
  }

  const STEP_DEFS = [
    {
      id: "profile",
      title: "Fill in your buyer profile (one time, used on every bank)",
      detail: profileComplete
        ? `Saved: ${profile.firmName}, ${profile.state} license ${profile.licenseNumber || "—"}`
        : "Click the button below to enter your firm, license, bond, and servicer once. Every email auto-fills from this.",
      cta: profileComplete ? "Edit profile" : "Fill profile",
      action: () => setProfileOpen(true),
    },
    {
      id: "emails",
      title: `Send the outreach email to ${recommendedBrokers.length} broker${recommendedBrokers.length === 1 ? "" : "s"} this week`,
      detail: profileComplete
        ? "Click Copy email next to each broker. Paste into your email client and send."
        : "Fill your profile first — the email auto-fills with your firm info.",
    },
    {
      id: "pipeline",
      title: dealForTicker(ticker)
        ? `Already in Pipeline — last updated ${formatPipelineAge(dealForTicker(ticker)!.updatedAt)}`
        : "Add this bank to your Pipeline as 'Sourced'",
      detail: dealForTicker(ticker)
        ? "Click Open Pipeline to update stage as the deal progresses."
        : "Creates a real deal entry pre-filled with bank, signal note, and today's date.",
      cta: dealForTicker(ticker) ? "Open Pipeline" : "Add + open",
      action: () => {
        if (!dealForTicker(ticker)) {
          const primaryBroker = recommendedBrokers[0]?.name || "—";
          const signalNote = `Sourced from radar: ${signalLabel}${
            typeof yoyPct === "number" ? ` (+${Math.round(yoyPct)}% YoY)` : ""
          }. Recommended brokers: ${recommendedBrokers.map((b) => b.shortName).join(", ")}.`;
          upsertDealForBank({
            ticker,
            brokerName: primaryBroker,
            assetClass: inferAssetClass(bankName),
            signalNote,
          });
          setPipelineToast(`Added ${ticker} to Pipeline.`);
          setTimeout(() => setPipelineToast(null), 2400);
          if (!steps.pipeline) toggleStep("pipeline");
        }
        window.location.href = "/app/pipeline";
      },
    },
    {
      id: "tutor",
      title: "Rehearse the call with the AI tutor",
      detail: "Pre-loaded with this bank's signal and your buyer profile. Practice handling tough questions.",
      cta: "Open tutor",
      action: () =>
        (window.location.href = `/app/tutor?ticker=${ticker}&bank=${encodeURIComponent(bankName)}&signal=${encodeURIComponent(signalLabel)}${
          typeof yoyPct === "number" ? `&yoy=${Math.round(yoyPct)}` : ""
        }`),
    },
  ];

  const stepsComplete = STEP_DEFS.filter((s) => steps[s.id]).length;

  return (
    <section className="mb-10">
      <div className="rounded-xl border border-[color:var(--color-accent-dim)] bg-gradient-to-br from-[color:var(--color-bg-1)] via-[color:var(--color-bg-soft)] to-[color:var(--color-bg-1)] p-6 md:p-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
              Your plan for {ticker} this week
            </div>
            <h2 className="mt-2 font-serif text-2xl md:text-3xl text-[color:var(--color-fg)] tracking-tight italic">
              4 steps. ~30 minutes.
            </h2>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              Progress
            </div>
            <div className="text-[18px] font-mono text-[color:var(--color-accent)] mt-1">
              {stepsComplete} / 4
            </div>
          </div>
        </div>

        <ol className="space-y-2">
          {STEP_DEFS.map((s, i) => {
            const done = !!steps[s.id];
            const justDone = celebration.isJustDone(s.id);
            return (
              <li
                key={s.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                  done
                    ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
                } ${justDone ? "animate-row-glow" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleStep(s.id)}
                  className={`relative shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
                    done
                      ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-[color:var(--color-bg)]"
                      : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)]"
                  } ${justDone ? "animate-check-pop" : ""}`}
                  aria-label={done ? "Mark step incomplete" : "Mark step complete"}
                >
                  {done ? "✓" : <span className="font-mono text-[12px] text-[color:var(--color-fg-faint)]">{i + 1}</span>}
                  {justDone && <SparkleBurst />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] font-medium ${done ? "line-through text-[color:var(--color-fg-dim)]" : "text-[color:var(--color-fg)]"}`}>
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[color:var(--color-fg-dim)]">
                    {s.detail}
                  </div>
                </div>
                {s.cta && (
                  <button
                    type="button"
                    onClick={s.action}
                    className="shrink-0 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                  >
                    {s.cta}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Recommended brokers + email composer */}
      <div className="mt-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Step 2 · Email these brokers
        </div>
        <p className="text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Don&rsquo;t email all three at once — pick one, send, wait 3–5 days, then try the
          next. Multi-brokering the same lead burns relationships if both reply with deals.
        </p>

        <div className="mt-5 space-y-3">
          {recommendedBrokers.map((b) => (
            <div
              key={b.shortName}
              className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[15px] font-medium text-[color:var(--color-fg)]">
                    {b.name}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[color:var(--color-fg-dim)]">
                    {b.why}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                    How to reach: <span className="tracking-normal lowercase">{b.contactPath}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                  >
                    Site ↗
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
            The email you send (auto-filled from your profile)
          </div>
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4">
            <div className="font-mono text-[11px] text-[color:var(--color-fg-dim)] mb-2">
              <span className="text-[color:var(--color-fg-faint)]">Subject:</span>{" "}
              {outreach.subject}
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] text-[color:var(--color-fg)] leading-relaxed">
              {outreach.body}
            </pre>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  copy(`Subject: ${outreach.subject}\n\n${outreach.body}`, "outreach");
                  setPickBrokerFor("copy");
                }}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
              >
                {copied === "outreach" ? "Copied ✓" : "Copy email"}
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent(outreach.subject)}&body=${encodeURIComponent(outreach.body)}`}
                onClick={() => setPickBrokerFor("mailto")}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
              >
                Open in mail ↗
              </a>
              <button
                type="button"
                onClick={() => setPickBrokerFor("send")}
                disabled={!profileComplete}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded text-[#1a0c00] hover:opacity-90 disabled:opacity-40 transition"
                style={{ background: "var(--gradient-primary)" }}
              >
                Send via Tradeline ⚡
              </button>
              <button
                type="button"
                onClick={() => copy(profileSheet, "profile-sheet")}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
              >
                {copied === "profile-sheet" ? "Copied ✓" : "Copy profile sheet"}
              </button>
              {!profileComplete && (
                <span className="text-[11px] text-[color:var(--color-warn)]">
                  ↑ Fill profile first (Step 1) so this auto-fills with your info.
                </span>
              )}
            </div>

            {pickBrokerFor && pickBrokerFor !== "send" && (
              <div className="mt-4 rounded-lg border border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)] p-3">
                <div className="text-[12px] text-[color:var(--color-fg)] mb-2">
                  <strong>Which broker did you send to?</strong> Tracks the date so
                  the &ldquo;no reply&rdquo; follow-up fires automatically.
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {recommendedBrokers.map((b) => (
                    <button
                      key={b.shortName}
                      type="button"
                      onClick={() => {
                        logOutreach({
                          ticker,
                          brokerShortName: b.shortName,
                          brokerName: b.name,
                          sentAt: new Date().toISOString(),
                        });
                        setPickBrokerFor(null);
                        if (!steps.emails) toggleStep("emails");
                      }}
                      className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                    >
                      Sent to {b.shortName}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPickBrokerFor(null)}
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {pickBrokerFor === "send" && (
              <SendForm
                brokers={recommendedBrokers}
                ticker={ticker}
                bankName={bankName}
                subject={outreach.subject}
                body={outreach.body}
                replyTo={profile.email || undefined}
                userEmail={profile.email || undefined}
                onClose={() => setPickBrokerFor(null)}
                onSent={(broker, messageId, reminderCount) => {
                  logOutreach({
                    ticker,
                    brokerShortName: broker.shortName,
                    brokerName: broker.name,
                    sentAt: new Date().toISOString(),
                  });
                  setSendResult({
                    kind: "ok",
                    broker: broker.name,
                    messageId,
                    reminderCount,
                  });
                  if (!steps.emails) toggleStep("emails");
                  setPickBrokerFor(null);
                }}
                onDisabled={() => setSendResult({ kind: "disabled" })}
                onError={(msg) => setSendResult({ kind: "error", message: msg })}
                sending={sendingTo}
                setSending={setSendingTo}
              />
            )}

            {sendResult && (
              <div
                className={`mt-3 rounded-lg px-3 py-2 text-[12px] flex items-center justify-between gap-3 flex-wrap ${
                  sendResult.kind === "ok"
                    ? "bg-[color:var(--color-success-soft)] border border-[color:var(--color-success-dim)] text-[color:var(--color-success)]"
                    : sendResult.kind === "disabled"
                      ? "bg-[color:var(--color-bg-soft)] border border-[color:var(--color-warn)] text-[color:var(--color-warn)]"
                      : "bg-[color:var(--color-bg-soft)] border border-[color:var(--color-danger)] text-[color:var(--color-danger)]"
                }`}
              >
                <span>
                  {sendResult.kind === "ok" && (
                    <>
                      ✓ Sent to {sendResult.broker}
                      {sendResult.reminderCount > 0 && (
                        <>
                          {" · "}
                          {sendResult.reminderCount} follow-up reminder
                          {sendResult.reminderCount === 1 ? "" : "s"} scheduled
                        </>
                      )}
                    </>
                  )}
                  {sendResult.kind === "disabled" &&
                    "Auto-send needs RESEND_API_KEY on the server. Use Copy or Open in mail for now."}
                  {sendResult.kind === "error" && `Send failed: ${sendResult.message}`}
                </span>
                <button
                  type="button"
                  onClick={() => setSendResult(null)}
                  className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-70 hover:opacity-100 transition"
                >
                  Dismiss
                </button>
              </div>
            )}

            {outreachEvents.length > 0 && (
              <div className="mt-4 text-[12px] text-[color:var(--color-fg-dim)] space-y-1">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
                  Outreach log
                </div>
                {outreachEvents.map((e) => {
                  const days = Math.floor(
                    (Date.now() - new Date(e.sentAt).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const tone =
                    days >= 14
                      ? "text-[color:var(--color-warn)]"
                      : days >= 7
                        ? "text-[color:var(--color-warn)]"
                        : "text-[color:var(--color-fg-dim)]";
                  return (
                    <div key={e.sentAt} className={`flex items-center gap-2 ${tone}`}>
                      <span className="font-mono">→</span>
                      <span>
                        Sent to <strong>{e.brokerShortName}</strong> ·{" "}
                        {days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}
                      </span>
                      {days >= 14 && <span className="font-mono text-[10px]">stop chasing →</span>}
                      {days >= 7 && days < 14 && (
                        <span className="font-mono text-[10px]">follow up →</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outcomes */}
      <div className="mt-6 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
          Step 3 · What you'll hear back and what to say
        </div>
        <p className="text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          Click any reply to expand the response template. Copy-paste, edit names, send.
        </p>

        <div className="mt-4 space-y-2">
          {outcomes.map((o) => {
            const expanded = expandedOutcome === o.id;
            const suggested = suggestedOutcome === o.id;
            return (
              <details
                key={o.id}
                open={expanded}
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedOutcome(expanded ? null : o.id);
                }}
                className={`rounded-lg border bg-[color:var(--color-bg-soft)] overflow-hidden ${
                  suggested
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)]"
                }`}
              >
                <summary className="cursor-pointer list-none px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--color-bg-2)] transition">
                  <span className="shrink-0 mt-1 text-[color:var(--color-fg-faint)] font-mono text-[12px]">
                    {expanded ? "−" : "+"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[color:var(--color-fg)] italic flex items-center gap-2 flex-wrap">
                      <span>{o.trigger}</span>
                      {suggested && (
                        <span className="font-mono text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] not-italic">
                          You're here now
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--color-fg-dim)]">
                      Your move: {o.yourMove}
                    </div>
                  </div>
                </summary>
                {expanded && (
                  <div className="px-4 pb-4 border-t border-[color:var(--color-line)]">
                    {o.responseSubject && (
                      <div className="mt-3 font-mono text-[11px] text-[color:var(--color-fg-dim)]">
                        <span className="text-[color:var(--color-fg-faint)]">Subject:</span>{" "}
                        {o.responseSubject}
                      </div>
                    )}
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px] text-[color:var(--color-fg)] leading-relaxed bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded p-3">
                      {o.responseBody}
                    </pre>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {o.responseSubject && (
                        <button
                          type="button"
                          onClick={() =>
                            copy(`Subject: ${o.responseSubject}\n\n${o.responseBody}`, o.id)
                          }
                          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
                        >
                          {copied === o.id ? "Copied ✓" : "Copy reply"}
                        </button>
                      )}
                      {o.nextAction && (
                        <Link
                          href={o.nextAction.href}
                          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
                        >
                          {o.nextAction.label}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </div>

      {/* Profile modal */}
      {profileOpen && (
        <div
          role="dialog"
          aria-label="Buyer profile"
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh] pb-6 bg-black/60 backdrop-blur-sm overflow-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-2xl text-[color:var(--color-fg)] italic">
                Your buyer profile
              </h3>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)]"
              >
                Close ✕
              </button>
            </div>
            <p className="text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed mb-4">
              Fill this in once. Every email and buyer-profile sheet auto-fills from
              these fields. Saved to your browser only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProfileField label="Your name" value={profile.yourName} onChange={(v) => saveProfile({ ...profile, yourName: v })} placeholder="Jane Doe" />
              <ProfileField label="Firm name" value={profile.firmName} onChange={(v) => saveProfile({ ...profile, firmName: v })} placeholder="Tradeline Capital LLC" />
              <ProfileField label="License state" value={profile.state} onChange={(v) => saveProfile({ ...profile, state: v })} placeholder="VA" />
              <ProfileField label="License number" value={profile.licenseNumber} onChange={(v) => saveProfile({ ...profile, licenseNumber: v })} placeholder="DBC-12345" />
              <ProfileField label="Bond carrier" value={profile.bondCarrier} onChange={(v) => saveProfile({ ...profile, bondCarrier: v })} placeholder="Hiscox" />
              <ProfileField label="Bond amount" value={profile.bondAmount} onChange={(v) => saveProfile({ ...profile, bondAmount: v })} placeholder="$25,000" />
              <ProfileField label="Servicer" value={profile.servicer} onChange={(v) => saveProfile({ ...profile, servicer: v })} placeholder="NCB Management" />
              <ProfileField label="Asset focus" value={profile.assetFocus} onChange={(v) => saveProfile({ ...profile, assetFocus: v })} placeholder="credit card, consumer" />
              <ProfileField label="Ticket range" value={profile.ticketRange} onChange={(v) => saveProfile({ ...profile, ticketRange: v })} placeholder="$50k–$500k" />
              <ProfileField label="Phone" value={profile.phone} onChange={(v) => saveProfile({ ...profile, phone: v })} placeholder="(555) 555-0123" />
              <ProfileField label="Email" value={profile.email} onChange={(v) => saveProfile({ ...profile, email: v })} placeholder="jane@firm.com" />
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="text-[12px] text-[color:var(--color-fg-faint)]">
                Saves automatically as you type.
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  if (profileComplete) toggleStep("profile");
                }}
                className="font-mono text-[11px] tracking-[0.18em] uppercase px-4 py-2 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {stepsComplete === STEP_DEFS.length && !milestoneSeen && (
        <div className="mt-6">
          <MilestoneBanner
            visible
            label={`${ticker} playbook complete this week.`}
            sublabel="Profile filled, brokers emailed, pipeline tracked, tutor rehearsed. Wait for the reply — and if 7 days pass with silence, the follow-up template auto-expands."
            onDismiss={() => setMilestoneSeen(true)}
          />
        </div>
      )}
      <CelebrationToast message={celebration.toast} />
    </section>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[14px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
      />
    </div>
  );
}

type BrokerLike = { shortName: string; name: string; url: string; contactPath: string };

function SendForm({
  brokers,
  ticker,
  bankName,
  subject,
  body,
  replyTo,
  userEmail,
  onClose,
  onSent,
  onDisabled,
  onError,
  sending,
  setSending,
}: {
  brokers: BrokerLike[];
  ticker: string;
  bankName: string;
  subject: string;
  body: string;
  replyTo?: string;
  userEmail?: string;
  onClose: () => void;
  onSent: (broker: BrokerLike, messageId: string, reminderCount: number) => void;
  onDisabled: () => void;
  onError: (msg: string) => void;
  sending: string | null;
  setSending: (v: string | null) => void;
}) {
  const [selectedBroker, setSelectedBroker] = useState<BrokerLike>(brokers[0]);
  const [recipient, setRecipient] = useState("");
  const [scheduleReminders, setScheduleReminders] = useState(true);

  const canRemind = scheduleReminders && Boolean(userEmail?.trim());

  const buildReminders = () => {
    if (!canRemind) return [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const day7 = new Date(now + 7 * dayMs).toISOString();
    const day14 = new Date(now + 14 * dayMs).toISOString();
    return [
      {
        scheduledAt: day7,
        to: userEmail!,
        subject: `Follow up · ${ticker} to ${selectedBroker.shortName}`,
        text: `It's been 7 days since you sent the outreach email to ${selectedBroker.name} about ${bankName} (${ticker}). No reply yet?

If they haven't responded, the follow-up template is pre-filled on the bank detail page. Short, references the original outreach, ends with a concrete ask:

  https://tradeline.io/app/banks/${ticker}

If they DID reply but you forgot to log it, paste their email into the Broker Reply Classifier on that same page and Tradeline AI will draft your response.

— Tradeline AI`,
      },
      {
        scheduledAt: day14,
        to: userEmail!,
        subject: `Stop chasing · ${ticker} to ${selectedBroker.shortName}`,
        text: `It's been 14 days since you emailed ${selectedBroker.name} about ${bankName} (${ticker}). Time to move on.

Don't send a third email — that burns the relationship for the next opportunity. Mark them cold in your Pipeline and try the next broker.

The bank detail page shows the 2 alternate brokers ranked for this ticker:

  https://tradeline.io/app/banks/${ticker}

— Tradeline AI`,
      },
    ];
  };

  const submit = async () => {
    if (!recipient.trim()) return;
    setSending(selectedBroker.shortName);
    try {
      const reminders = buildReminders();
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient.trim(),
          subject,
          text: body,
          replyTo,
          reminders,
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        onDisabled();
        return;
      }
      if (!r.ok || data.error) {
        onError(data.error || `HTTP ${r.status}`);
        return;
      }
      const scheduledCount = Array.isArray(data.scheduled)
        ? data.scheduled.filter((s: { id: string | null }) => s.id).length
        : 0;
      onSent(selectedBroker, data.providerMessageId || "", scheduledCount);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] p-3 space-y-3">
      <div className="text-[12px] text-[color:var(--color-fg)]">
        <strong>Send via Tradeline.</strong> The email goes out from your verified
        Resend domain. Replies go to your inbox.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[color:var(--color-fg-faint)] font-mono tracking-[0.12em] uppercase">
          To broker:
        </span>
        {brokers.map((b) => (
          <button
            key={b.shortName}
            type="button"
            onClick={() => setSelectedBroker(b)}
            className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1 rounded transition ${
              selectedBroker.shortName === b.shortName
                ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg)]"
                : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            {b.shortName}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={`${selectedBroker.shortName.toLowerCase()} contact email…`}
          className="flex-1 min-w-[220px] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded px-3 py-1.5 text-[12px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!recipient.trim() || sending !== null}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded text-[#1a0c00] hover:opacity-90 disabled:opacity-40 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          {sending ? "Sending…" : "Send now ⚡"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
        >
          Cancel
        </button>
      </div>
      <label className="flex items-start gap-2 text-[11px] text-[color:var(--color-fg-dim)] leading-snug cursor-pointer">
        <input
          type="checkbox"
          checked={scheduleReminders}
          onChange={(e) => setScheduleReminders(e.target.checked)}
          disabled={!userEmail?.trim()}
          className="mt-0.5 accent-[color:var(--color-accent)]"
        />
        <span>
          {userEmail?.trim() ? (
            <>
              Also email <strong className="text-[color:var(--color-fg)]">{userEmail}</strong> on{" "}
              <strong className="text-[color:var(--color-fg)]">day 7</strong> if no reply, and{" "}
              <strong className="text-[color:var(--color-fg)]">day 14</strong> to stop chasing.
              Tradeline AI auto-schedules both via Resend right now.
            </>
          ) : (
            <>
              Add your email to <a href="/app/profile" className="text-[color:var(--color-accent)] hover:underline">your profile</a> to unlock auto-scheduled day-7 + day-14 follow-up reminders.
            </>
          )}
        </span>
      </label>
      <p className="text-[10px] text-[color:var(--color-fg-faint)] leading-relaxed">
        Don&rsquo;t know the broker&rsquo;s email? Most brokers list a contact form
        on their site (
        <a href={selectedBroker.url} target="_blank" rel="noreferrer" className="text-[color:var(--color-accent)] hover:underline">
          {selectedBroker.url.replace(/^https?:\/\//, "")}
        </a>
        ) or you can fill in the contact form there. For warm intros via RMAI or
        a referral, paste their address here.
      </p>
    </div>
  );
}
