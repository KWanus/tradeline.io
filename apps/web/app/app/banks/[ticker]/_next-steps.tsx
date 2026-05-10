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

const STEPS_KEY_PREFIX = "tradeline.bank_playbook_steps.";

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STEPS_KEY_PREFIX + ticker);
      if (raw) setSteps(JSON.parse(raw));
    } catch {}
  }, [ticker]);

  const toggleStep = (id: string) => {
    const next = { ...steps, [id]: !steps[id] };
    setSteps(next);
    try {
      window.localStorage.setItem(STEPS_KEY_PREFIX + ticker, JSON.stringify(next));
    } catch {}
  };

  const ctx = { ticker, bankName, signalLabel, yoyPct };
  const outreach = useMemo(() => buildOutreachEmail(profile, ctx), [profile, ticker, bankName, signalLabel, yoyPct]);
  const profileSheet = useMemo(() => buildBuyerProfileSheet(profile), [profile]);
  const outcomes = useMemo(() => OUTCOME_DEFS(profile, ctx), [profile, ticker, bankName, signalLabel, yoyPct]);

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
      title: "Add this bank to your Pipeline as 'Sourced'",
      detail: "Tracks the deal so you don't forget to follow up.",
      cta: "Open Pipeline",
      action: () => (window.location.href = "/app/pipeline"),
    },
    {
      id: "tutor",
      title: "Rehearse the call with the AI tutor",
      detail: "Pre-loaded with this bank's signal and your buyer profile. Practice handling tough questions.",
      cta: "Open tutor",
      action: () =>
        (window.location.href = `/app/tutor?ticker=${ticker}&bank=${encodeURIComponent(bankName)}`),
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
            return (
              <li
                key={s.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                  done
                    ? "border-[color:var(--color-accent-dim)] bg-[color:var(--color-accent-soft)]"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-bg-1)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleStep(s.id)}
                  className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
                    done
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-bg)]"
                      : "border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)]"
                  }`}
                  aria-label={done ? "Mark step incomplete" : "Mark step complete"}
                >
                  {done ? "✓" : <span className="font-mono text-[12px] text-[color:var(--color-fg-faint)]">{i + 1}</span>}
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
                onClick={() => copy(`Subject: ${outreach.subject}\n\n${outreach.body}`, "outreach")}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
              >
                {copied === "outreach" ? "Copied ✓" : "Copy email"}
              </button>
              <button
                type="button"
                onClick={() => copy(profileSheet, "profile-sheet")}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
              >
                {copied === "profile-sheet" ? "Copied ✓" : "Copy buyer profile sheet"}
              </button>
              {!profileComplete && (
                <span className="text-[11px] text-[color:var(--color-warn)]">
                  ↑ Fill profile first (Step 1) so this auto-fills with your info.
                </span>
              )}
            </div>
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
            return (
              <details
                key={o.id}
                open={expanded}
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedOutcome(expanded ? null : o.id);
                }}
                className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] overflow-hidden"
              >
                <summary className="cursor-pointer list-none px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--color-bg-2)] transition">
                  <span className="shrink-0 mt-1 text-[color:var(--color-fg-faint)] font-mono text-[12px]">
                    {expanded ? "−" : "+"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-[color:var(--color-fg)] italic">
                      {o.trigger}
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
