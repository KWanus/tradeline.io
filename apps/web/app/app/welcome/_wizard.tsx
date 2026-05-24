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
import { logOutreach } from "@/lib/bank-state";
import { upsertDealForBank } from "@/lib/pipeline";
import { buildIcs, buildOutreachFollowUps, downloadIcs } from "@/lib/ics";
import {
  CelebrationToast,
  MilestoneBanner,
  SparkleBurst,
  useDoneCelebration,
} from "../_components/celebrate";

const WELCOME_DONE_KEY = "tradeline.welcome_completed.v1";

type StrongBank = {
  ticker: string;
  name: string;
  tier: string;
  signalLabel: string;
  signalAction: string;
  yoyPct: number | null;
  newsMentions: number;
};

type Step = "intro" | "profile" | "bank" | "send" | "done";
const STEP_ORDER: Step[] = ["intro", "profile", "bank", "send", "done"];

// The 4 critical profile fields for first-email auto-fill.
const PROFILE_FIELDS: Array<{
  key: keyof BuyerProfile;
  label: string;
  placeholder: string;
  required?: boolean;
  hint?: string;
}> = [
  { key: "yourName", label: "Your name", placeholder: "Jane Doe", required: true },
  { key: "firmName", label: "Your firm", placeholder: "Tradeline Capital LLC", required: true },
  { key: "state", label: "Licensed state", placeholder: "VA", required: true, hint: "Use a 2-letter state code." },
  { key: "assetFocus", label: "Asset focus", placeholder: "credit card, consumer", required: true, hint: "What kinds of debt portfolios you'd buy." },
  { key: "email", label: "Your email", placeholder: "you@yourfirm.com", required: true, hint: "Where Tradeline AI sends day-7 / day-14 reminders." },
  { key: "licenseNumber", label: "License #", placeholder: "DBC-12345" },
  { key: "bondCarrier", label: "Bond carrier", placeholder: "Hiscox" },
  { key: "bondAmount", label: "Bond amount", placeholder: "$25,000" },
  { key: "servicer", label: "Servicer", placeholder: "NCB Management" },
  { key: "ticketRange", label: "Ticket range", placeholder: "$50k–$500k" },
];

const REQUIRED_KEYS: Array<keyof BuyerProfile> = ["yourName", "firmName", "state", "assetFocus", "email"];

export function WelcomeWizard({ strongBanks }: { strongBanks: StrongBank[] }) {
  const [profile, saveProfile] = useBuyerProfile();
  const [step, setStep] = useState<Step>("intro");
  const [selectedTicker, setSelectedTicker] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [sendState, setSendState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; broker: string; messageId: string; reminderCount: number }
    | { kind: "disabled" }
    | { kind: "error"; message: string }
    | { kind: "copied" }
    | { kind: "mailto" }
  >({ kind: "idle" });
  const [completed, setCompleted] = useState(false);
  const celebration = useDoneCelebration();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(WELCOME_DONE_KEY) === "1") setCompleted(true);
    } catch {}
  }, []);

  const stepIdx = STEP_ORDER.indexOf(step);
  const pct = ((stepIdx + 1) / STEP_ORDER.length) * 100;

  const profileReady = REQUIRED_KEYS.every((k) => (profile[k] || "").trim().length > 0);
  const selectedBank = strongBanks.find((b) => b.ticker === selectedTicker);

  // Pre-fill recipient from a heuristic — most brokers prefer their named contact.
  // We don't actually know it, so leave blank but suggest mailto if they want to fill manually.

  const outreach = useMemo(() => {
    if (!selectedBank) return { subject: "", body: "" };
    const ctx = {
      ticker: selectedBank.ticker,
      bankName: selectedBank.name,
      signalLabel: selectedBank.signalLabel,
      yoyPct: selectedBank.yoyPct ?? undefined,
    };
    const subject = fillTemplate("[STATE] licensed buyer — interest in [TICKER] paper", profile, ctx);
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
      profile,
      ctx
    );
    return { subject, body };
  }, [profile, selectedBank]);

  const advance = () => {
    const next = STEP_ORDER[Math.min(stepIdx + 1, STEP_ORDER.length - 1)];
    setStep(next);
    celebration.trigger(step, `Step done · ${step}`);
    if (next === "done") {
      try {
        window.localStorage.setItem(WELCOME_DONE_KEY, "1");
      } catch {}
    }
  };

  const back = () => {
    const prev = STEP_ORDER[Math.max(stepIdx - 1, 0)];
    setStep(prev);
  };

  const sendOutreach = async (broker: string) => {
    if (!recipientEmail.trim()) return;
    setSendState({ kind: "sending" });
    const dayMs = 24 * 60 * 60 * 1000;
    try {
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          subject: outreach.subject,
          text: outreach.body,
          replyTo: profile.email || undefined,
          reminders: profile.email
            ? [
                {
                  scheduledAt: new Date(Date.now() + 7 * dayMs).toISOString(),
                  to: profile.email,
                  subject: `Follow up · ${selectedBank?.ticker} to ${broker}`,
                  text: `7 days since you sent the outreach for ${selectedBank?.name} (${selectedBank?.ticker}). If no reply, the follow-up template is pre-filled at https://tradeline.io/app/banks/${selectedBank?.ticker}.\n\n— Tradeline AI`,
                },
                {
                  scheduledAt: new Date(Date.now() + 14 * dayMs).toISOString(),
                  to: profile.email,
                  subject: `Stop chasing · ${selectedBank?.ticker} to ${broker}`,
                  text: `14 days since the outreach. Mark this broker cold and try the next pick at https://tradeline.io/app/banks/${selectedBank?.ticker}.\n\n— Tradeline AI`,
                },
              ]
            : [],
        }),
      });
      const data = await r.json();
      if (data.enabled === false) {
        setSendState({ kind: "disabled" });
        return;
      }
      if (!r.ok || data.error) {
        setSendState({ kind: "error", message: data.error || `HTTP ${r.status}` });
        return;
      }
      const scheduledCount = Array.isArray(data.scheduled)
        ? data.scheduled.filter((s: { id: string | null }) => s.id).length
        : 0;
      // Log + pipeline + calendar + advance
      if (selectedBank) {
        logOutreach({
          ticker: selectedBank.ticker,
          brokerShortName: broker,
          brokerName: broker,
          sentAt: new Date().toISOString(),
        });
        upsertDealForBank({
          ticker: selectedBank.ticker,
          brokerName: broker,
          assetClass: "Credit card",
          signalNote: `First outreach via welcome wizard · ${selectedBank.signalLabel}.`,
        });
        // Drop calendar reminders too — first-run users get both for free
        const ics = buildIcs(
          buildOutreachFollowUps({
            ticker: selectedBank.ticker,
            bankName: selectedBank.name,
            brokerShortName: broker,
            brokerName: broker,
            sentAt: new Date(),
            siteUrl:
              typeof window !== "undefined" ? window.location.origin : "https://tradeline.io",
          })
        );
        downloadIcs(`tradeline-${selectedBank.ticker}-${broker}-follow-ups.ics`, ics);
      }
      setSendState({
        kind: "ok",
        broker,
        messageId: data.providerMessageId || "",
        reminderCount: scheduledCount,
      });
      advance();
    } catch (err) {
      setSendState({ kind: "error", message: (err as Error).message });
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(
        `Subject: ${outreach.subject}\n\n${outreach.body}`
      );
      setSendState({ kind: "copied" });
      if (selectedBank) {
        logOutreach({
          ticker: selectedBank.ticker,
          brokerShortName: "Pending",
          brokerName: "Sent via Copy — log broker later",
          sentAt: new Date().toISOString(),
        });
        upsertDealForBank({
          ticker: selectedBank.ticker,
          brokerName: "Pending",
          assetClass: "Credit card",
          signalNote: `First outreach via welcome wizard · ${selectedBank.signalLabel}.`,
        });
      }
      setTimeout(() => advance(), 1500);
    } catch {}
  };

  // Already-completed banner
  if (completed && step === "intro") {
    return (
      <main className="px-6 md:px-10 lg:px-14 py-16 max-w-3xl">
        <div className="rounded-2xl p-8 md:p-10 text-center"
          style={{
            background:
              "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
            border: "1.5px solid transparent",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)] mb-3">
            Welcome back
          </div>
          <h1 className="font-semibold text-3xl md:text-4xl text-[color:var(--color-fg)] tracking-tight">
            You&rsquo;ve already finished the welcome wizard.
          </h1>
          <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Your profile is saved and your first outreach is logged. Continue from{" "}
            <Link href="/app/today" className="text-[color:var(--color-accent)] hover:underline">
              /app/today
            </Link>{" "}
            — the daily briefing and Right-Now widget point you at the next action.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/app/today" className="btn-primary">
              Go to Today
            </Link>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem(WELCOME_DONE_KEY);
                } catch {}
                setCompleted(false);
              }}
              className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
            >
              Restart wizard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 md:px-10 lg:px-14 py-10 max-w-3xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Welcome · Step {stepIdx + 1} of {STEP_ORDER.length}
          </div>
          <div className="font-mono text-[10px] tracking-[0.22em] text-[color:var(--color-accent)]">
            {Math.round(pct)}%
          </div>
        </div>
        <div className="h-1.5 bg-[color:var(--color-bg-1)] rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: "var(--gradient-primary)",
              boxShadow: "0 0 12px rgba(var(--tint-accent-2-rgb), 0.45)",
            }}
          />
        </div>
      </div>

      {step === "intro" && <IntroScreen onNext={advance} />}
      {step === "profile" && (
        <ProfileScreen
          profile={profile}
          saveProfile={saveProfile}
          profileReady={profileReady}
          onNext={advance}
          onBack={back}
        />
      )}
      {step === "bank" && (
        <BankScreen
          strongBanks={strongBanks}
          selectedTicker={selectedTicker}
          onSelect={setSelectedTicker}
          onNext={advance}
          onBack={back}
        />
      )}
      {step === "send" && selectedBank && (
        <SendScreen
          bank={selectedBank}
          profile={profile}
          outreach={outreach}
          recipientEmail={recipientEmail}
          onRecipientChange={setRecipientEmail}
          sendState={sendState}
          onSend={sendOutreach}
          onCopy={copyEmail}
          onSkipSend={() => {
            setSendState({ kind: "mailto" });
            advance();
          }}
          onBack={back}
        />
      )}
      {step === "done" && selectedBank && (
        <DoneScreen bank={selectedBank} sendState={sendState} />
      )}

      <CelebrationToast message={celebration.toast} />
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function IntroScreen({ onNext }: { onNext: () => void }) {
  return (
    <section>
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Welcome to Tradeline
      </div>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl tracking-tight leading-[1.05] text-[color:var(--color-fg)]">
        In 5 minutes you&rsquo;ll have{" "}
        <span className="italic text-gradient-accent">
          your first outreach email out
        </span>
        .
      </h1>
      <p className="mt-5 text-[15px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
        Four screens. No reading. Tradeline picks the right bank, fills the email,
        sends it, and schedules the day-7 + day-14 follow-up reminders to your
        inbox automatically.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3">
        <PreviewCard num="01" title="Your profile" detail="6 quick fields. Auto-fills every email forever." />
        <PreviewCard num="02" title="Pick a bank" detail="Tradeline shows the 3 hottest banks for outreach today." />
        <PreviewCard num="03" title="Send the email" detail="One click. Real Resend delivery or copy + paste." />
        <PreviewCard num="04" title="You're operational" detail="First deal in pipeline, reminders set, Today screen active." />
      </div>

      <div className="mt-10">
        <button type="button" onClick={onNext} className="btn-mega">
          Start the 5-minute setup
        </button>
        <p className="mt-3 text-[11px] text-[color:var(--color-fg-faint)]">
          Already set up? Skip to <Link href="/app/today" className="hover:text-[color:var(--color-accent)] transition">/app/today</Link>.
        </p>
      </div>
    </section>
  );
}

function PreviewCard({ num, title, detail }: { num: string; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-4">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        {num}
      </div>
      <div className="mt-1.5 text-[15px] font-medium text-[color:var(--color-fg)]">{title}</div>
      <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">{detail}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function ProfileScreen({
  profile,
  saveProfile,
  profileReady,
  onNext,
  onBack,
}: {
  profile: BuyerProfile;
  saveProfile: (p: BuyerProfile) => void;
  profileReady: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section>
      <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight text-[color:var(--color-fg)]">
        Your firm — fill once, auto-fills everywhere.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
        Top 5 fields are required for the first outreach email to make sense.
        The rest are nice-to-have — you can fill them later at <Link href="/app/profile" className="text-[color:var(--color-accent)] hover:underline">/app/profile</Link>.
      </p>

      <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROFILE_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
              {f.label}
              {f.required && <span className="text-[color:var(--color-accent)] ml-1">*</span>}
            </label>
            <input
              type="text"
              value={profile[f.key]}
              onChange={(e) => saveProfile({ ...profile, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="mt-1.5 w-full bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded-md px-3 py-2 text-[14px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
            />
            {f.hint && (
              <p className="mt-1 text-[10px] text-[color:var(--color-fg-faint)]">{f.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!profileReady}
          className="btn-primary disabled:opacity-40 disabled:pointer-events-none"
        >
          {profileReady ? "Continue" : "Fill the 5 required fields"}
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function BankScreen({
  strongBanks,
  selectedTicker,
  onSelect,
  onNext,
  onBack,
}: {
  strongBanks: StrongBank[];
  selectedTicker: string;
  onSelect: (t: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section>
      <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight text-[color:var(--color-fg)]">
        Pick the bank you want to{" "}
        <span className="italic text-gradient-accent">pitch first</span>.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
        Tradeline filtered the 57-bank radar down to the {strongBanks.length} with the strongest
        signals today. Pick one — we&rsquo;ll auto-write the outreach email for you next.
      </p>

      {strongBanks.length === 0 ? (
        <div className="mt-7 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6 text-center text-[color:var(--color-fg-dim)]">
          <p className="text-[14px]">
            No strong-signal banks today. Quiet morning. You can still pick one from{" "}
            <Link href="/app/banks" className="text-[color:var(--color-accent)] hover:underline">
              the full bank list
            </Link>
            {" "}or check back tomorrow.
          </p>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
          {strongBanks.map((b) => {
            const selected = selectedTicker === b.ticker;
            return (
              <button
                key={b.ticker}
                type="button"
                onClick={() => onSelect(b.ticker)}
                className="text-left rounded-xl p-5 transition group"
                style={
                  selected
                    ? {
                        background:
                          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
                        border: "1.5px solid transparent",
                      }
                    : {
                        background: "var(--color-bg-1)",
                        border: "1px solid var(--color-line)",
                      }
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl text-[color:var(--color-accent)]">{b.ticker}</span>
                    {selected && (
                      <span
                        className="font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded-full text-[#0a0c14] font-semibold"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        Picked
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
                    {b.tier}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--color-fg)] truncate">{b.name}</div>
                <div className="mt-3 text-[13px] text-[color:var(--color-fg)] leading-snug">
                  {b.signalLabel}
                  {typeof b.yoyPct === "number" && (
                    <span className="text-[color:var(--color-accent)]"> · +{Math.round(b.yoyPct)}% YoY</span>
                  )}
                </div>
                <div className="mt-1.5 text-[12px] text-[color:var(--color-fg-dim)] leading-snug line-clamp-2">
                  {b.signalAction}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!selectedTicker}
          className="btn-primary disabled:opacity-40 disabled:pointer-events-none"
        >
          {selectedTicker ? "Continue" : "Pick a bank to continue"}
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function SendScreen({
  bank,
  profile,
  outreach,
  recipientEmail,
  onRecipientChange,
  sendState,
  onSend,
  onCopy,
  onSkipSend,
  onBack,
}: {
  bank: StrongBank;
  profile: BuyerProfile;
  outreach: { subject: string; body: string };
  recipientEmail: string;
  onRecipientChange: (v: string) => void;
  sendState:
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; broker: string; messageId: string; reminderCount: number }
    | { kind: "disabled" }
    | { kind: "error"; message: string }
    | { kind: "copied" }
    | { kind: "mailto" };
  onSend: (broker: string) => void;
  onCopy: () => void;
  onSkipSend: () => void;
  onBack: () => void;
}) {
  const mailto = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(outreach.subject)}&body=${encodeURIComponent(outreach.body)}`;
  const isSending = sendState.kind === "sending";
  return (
    <section>
      <h2 className="font-serif text-3xl md:text-4xl tracking-tight leading-tight text-[color:var(--color-fg)]">
        Send the email to{" "}
        <span className="font-mono text-[color:var(--color-accent)]">{bank.ticker}</span>&rsquo;s broker.
      </h2>
      <p className="mt-3 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
        Pre-filled with your profile. Most debt brokers list a contact form or sales email on
        their website — paste it below to send via Tradeline, or use mailto if you&rsquo;d rather
        send from your own client.
      </p>

      <div className="mt-7 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5 space-y-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
            Recommended brokers for {bank.ticker}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {["NLEX", "Garnet", "RMG"].map((b) => (
              <span
                key={b}
                className="font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)]"
              >
                {b}
              </span>
            ))}
            <span className="text-[11px] text-[color:var(--color-fg-faint)]">
              Visit their sites to find a contact email or form.
            </span>
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Broker email
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => onRecipientChange(e.target.value)}
            placeholder="broker@firmname.com"
            className="mt-1.5 w-full bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[13px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          />
        </div>

        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-2">
            Preview · auto-filled from your profile
          </div>
          <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3">
            <div className="font-mono text-[11px] text-[color:var(--color-fg-dim)] mb-2">
              <span className="text-[color:var(--color-fg-faint)]">Subject:</span> {outreach.subject}
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] text-[color:var(--color-fg)] leading-relaxed">
              {outreach.body}
            </pre>
          </div>
        </div>

        {sendState.kind === "error" && (
          <div className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[12px] text-[color:var(--color-danger)]">
            {sendState.message}
          </div>
        )}
        {sendState.kind === "disabled" && (
          <div className="rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-3 py-2 text-[12px] text-[color:var(--color-warn)]">
            Auto-send needs RESEND_API_KEY on the server. Use Copy or Open in mail to continue.
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => onSend("NLEX")}
            disabled={!recipientEmail.trim() || isSending}
            className="btn-primary disabled:opacity-40 disabled:pointer-events-none"
          >
            {isSending ? "Sending…" : "Send via Tradeline ⚡"}
          </button>
          <a
            href={mailto}
            onClick={onSkipSend}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
          >
            Open in mail ↗
          </a>
          <button
            type="button"
            onClick={onCopy}
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Just copy email
          </button>
        </div>
        {profile.email && (
          <p className="text-[10px] text-[color:var(--color-fg-faint)] leading-relaxed">
            If you click Send via Tradeline, day-7 + day-14 follow-up reminders auto-schedule to{" "}
            <strong className="text-[color:var(--color-fg-dim)]">{profile.email}</strong>.
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)] transition"
        >
          ← Back
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function DoneScreen({
  bank,
  sendState,
}: {
  bank: StrongBank;
  sendState:
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; broker: string; messageId: string; reminderCount: number }
    | { kind: "disabled" }
    | { kind: "error"; message: string }
    | { kind: "copied" }
    | { kind: "mailto" };
}) {
  const sent = sendState.kind === "ok";
  const sentViaCopy = sendState.kind === "copied" || sendState.kind === "mailto";

  return (
    <section>
      <MilestoneBanner
        visible
        label="You're operational. Tradeline is your workbase."
        sublabel={
          sent
            ? `Email sent. ${sendState.reminderCount > 0 ? `${sendState.reminderCount} follow-up reminders scheduled to your inbox.` : "Follow-ups will surface in Today when the time comes."}`
            : sentViaCopy
              ? "Outreach logged. When the broker replies, paste their email into the classifier on the bank page."
              : "Profile saved. Use /app/today every morning for the daily briefing + Right-Now widget."
        }
      />

      <div className="mt-2 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
          What changed
        </div>
        <ul className="space-y-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="text-[color:var(--color-success)] mt-0.5 shrink-0">✓</span>
            <span>Buyer profile saved. Every outreach email + script auto-fills with your firm info.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[color:var(--color-success)] mt-0.5 shrink-0">✓</span>
            <span>{bank.ticker} added to your Pipeline as &ldquo;Sourced&rdquo;.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[color:var(--color-success)] mt-0.5 shrink-0">✓</span>
            <span>Outreach logged. Day-7 and day-14 timers running.</span>
          </li>
          {sent && sendState.reminderCount > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--color-success)] mt-0.5 shrink-0">✓</span>
              <span>{sendState.reminderCount} follow-up reminder emails scheduled via Resend.</span>
            </li>
          )}
          {sent && (
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--color-success)] mt-0.5 shrink-0">✓</span>
              <span>
                Calendar reminders downloaded (.ics) — open the file to add the
                day-7 + day-14 events to Google Calendar, Outlook, or Apple Calendar.
              </span>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/app/today" className="rounded-xl p-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:border-[color:var(--color-accent)] transition">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Tomorrow morning
          </div>
          <div className="mt-1 text-[14px] text-[color:var(--color-fg)] font-medium">
            Open /app/today
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            Daily AI briefing + Right-Now widget tell you what to do next.
          </div>
        </Link>
        <Link href={`/app/banks/${bank.ticker}`} className="rounded-xl p-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:border-[color:var(--color-accent)] transition">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            When they reply
          </div>
          <div className="mt-1 text-[14px] text-[color:var(--color-fg)] font-medium">
            Paste reply on {bank.ticker} page
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            Broker Reply Classifier reads it, classifies, drafts your response.
          </div>
        </Link>
        <Link href="/app/tutor" className="rounded-xl p-4 border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] hover:border-[color:var(--color-accent)] transition">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Before the call
          </div>
          <div className="mt-1 text-[14px] text-[color:var(--color-fg)] font-medium">
            Rehearse via Tradeline AI
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
            Three practice scenarios — cold call, custom email, price negotiation.
          </div>
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link href="/app/today" className="btn-mega">
          Go to Today
        </Link>
      </div>
    </section>
  );
}
