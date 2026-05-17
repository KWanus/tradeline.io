"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fillTemplate, useBuyerProfile } from "@/lib/buyer-profile";

type AssetPreset = {
  label: string;
  faceValue: number;
  recoveryPct: number;
  workoutYears: number;
  servicerFeePct: number;
  irrPct: number;
};

const PRESETS: AssetPreset[] = [
  {
    label: "Fresh CC charge-off · mid-Atlantic",
    faceValue: 5_000_000,
    recoveryPct: 14,
    workoutYears: 5,
    servicerFeePct: 35,
    irrPct: 30,
  },
  {
    label: "Aged CC paper (2-3 years)",
    faceValue: 5_000_000,
    recoveryPct: 7,
    workoutYears: 4,
    servicerFeePct: 35,
    irrPct: 35,
  },
  {
    label: "Subprime auto (secured)",
    faceValue: 5_000_000,
    recoveryPct: 22,
    workoutYears: 3,
    servicerFeePct: 25,
    irrPct: 25,
  },
  {
    label: "Junior mortgage, seasoned",
    faceValue: 5_000_000,
    recoveryPct: 55,
    workoutYears: 4,
    servicerFeePct: 15,
    irrPct: 20,
  },
];

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatPct(pct: number, digits = 1): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(digits)}%`;
}

export function BidCalculator() {
  const params = useSearchParams();
  const [face, setFace] = useState(PRESETS[0].faceValue);
  const [recoveryPct, setRecoveryPct] = useState(PRESETS[0].recoveryPct);
  const [workoutYears, setWorkoutYears] = useState(PRESETS[0].workoutYears);
  const [servicerFeePct, setServicerFeePct] = useState(PRESETS[0].servicerFeePct);
  const [irrPct, setIrrPct] = useState(PRESETS[0].irrPct);

  // Pre-load face value from URL deep-link (e.g. clicked from /app/tools/tape
  // or /app/pipeline). Sliders cap at 100M so big tapes still slide cleanly.
  useEffect(() => {
    const f = params?.get("face");
    if (f) {
      const n = Number(f);
      if (Number.isFinite(n) && n > 0) setFace(Math.min(n, 100_000_000));
    }
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const grossRecovery = face * (recoveryPct / 100);
  const netRecovery = grossRecovery * (1 - servicerFeePct / 100);
  const discount = Math.pow(1 + irrPct / 100, workoutYears);
  const maxBid = netRecovery / discount;
  const maxBidCentsPerDollar = (maxBid / face) * 100;
  const safeBid = maxBid * 0.85;
  const safeBidCentsPerDollar = (safeBid / face) * 100;

  const applyPreset = (p: AssetPreset) => {
    setFace(p.faceValue);
    setRecoveryPct(p.recoveryPct);
    setWorkoutYears(p.workoutYears);
    setServicerFeePct(p.servicerFeePct);
    setIrrPct(p.irrPct);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase mb-2">
          Quick presets
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="font-mono text-[11px] tracking-[0.05em] uppercase px-3 py-2 border border-[color:var(--color-line)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition text-[color:var(--color-fg-dim)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)]">
        <Slider
          label="Face value"
          value={face}
          min={100_000}
          max={500_000_000}
          step={100_000}
          format={formatUSD}
          onChange={setFace}
        />
        <Slider
          label="Expected recovery"
          value={recoveryPct}
          min={1}
          max={70}
          step={0.5}
          format={(v) => formatPct(v, 1) + " of face"}
          onChange={setRecoveryPct}
        />
        <Slider
          label="Work-out time"
          value={workoutYears}
          min={1}
          max={10}
          step={0.5}
          format={(v) => `${v} years`}
          onChange={setWorkoutYears}
        />
        <Slider
          label="Servicer fee"
          value={servicerFeePct}
          min={0}
          max={60}
          step={1}
          format={(v) => formatPct(v, 0) + " of collected"}
          onChange={setServicerFeePct}
        />
        <Slider
          label="Target IRR"
          value={irrPct}
          min={5}
          max={60}
          step={1}
          format={(v) => formatPct(v, 0) + " annual"}
          onChange={setIrrPct}
        />
        <div className="bg-[color:var(--color-bg-1)] p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
            Reset
          </div>
          <button
            type="button"
            onClick={() => applyPreset(PRESETS[0])}
            className="mt-3 font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
          >
            Default preset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line-strong)]">
        <Result label="Gross recovery (face × rate)" value={formatUSD(grossRecovery)} />
        <Result
          label="Net to you (after servicer)"
          value={formatUSD(netRecovery)}
          tone="ok"
        />
        <Result
          label="Max bid (NPV at IRR)"
          value={formatUSD(maxBid)}
          sub={`${formatPct(maxBidCentsPerDollar, 2)} of face`}
          tone="strong"
        />
      </div>

      <div className="border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          What this means
        </div>
        <p className="mt-3 text-[15px] text-[color:var(--color-fg)] leading-relaxed">
          On <span className="font-mono">{formatUSD(face)}</span> face value paper recovering{" "}
          <span className="font-mono">{formatPct(recoveryPct, 1)}</span> over{" "}
          <span className="font-mono">{workoutYears} years</span>, at a target IRR of{" "}
          <span className="font-mono">{formatPct(irrPct, 0)}</span>:
        </p>
        <ul className="mt-3 space-y-1.5 text-[14px] text-[color:var(--color-fg-dim)] list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-[color:var(--color-fg)]">Maximum bid</strong>{" "}
            <span className="font-mono">{formatUSD(maxBid)}</span> ·{" "}
            <span className="text-[color:var(--color-accent)]">{formatPct(maxBidCentsPerDollar, 2)}¢/dollar</span> — go above and the math doesn&rsquo;t pencil at your IRR target.
          </li>
          <li>
            <strong className="text-[color:var(--color-fg)]">Disciplined bid (15% margin)</strong>{" "}
            <span className="font-mono">{formatUSD(safeBid)}</span> ·{" "}
            <span className="text-[color:var(--color-warn)]">{formatPct(safeBidCentsPerDollar, 2)}¢/dollar</span> — what most experienced buyers actually submit, leaving room for surprises.
          </li>
        </ul>
      </div>

      <BidEmailComposer
        face={face}
        maxBid={maxBid}
        safeBid={safeBid}
        recoveryPct={recoveryPct}
        workoutYears={workoutYears}
        servicerFeePct={servicerFeePct}
        irrPct={irrPct}
        formatUSD={formatUSD}
        formatPct={formatPct}
        maxBidCentsPerDollar={maxBidCentsPerDollar}
        safeBidCentsPerDollar={safeBidCentsPerDollar}
      />
    </div>
  );
}

function BidEmailComposer({
  face,
  maxBid,
  safeBid,
  recoveryPct,
  workoutYears,
  servicerFeePct,
  irrPct,
  formatUSD,
  formatPct,
  maxBidCentsPerDollar,
  safeBidCentsPerDollar,
}: {
  face: number;
  maxBid: number;
  safeBid: number;
  recoveryPct: number;
  workoutYears: number;
  servicerFeePct: number;
  irrPct: number;
  formatUSD: (n: number) => string;
  formatPct: (n: number, d?: number) => string;
  maxBidCentsPerDollar: number;
  safeBidCentsPerDollar: number;
}) {
  const [profile] = useBuyerProfile();
  const params = useSearchParams();
  const [ticker, setTicker] = useState("");
  const [bankName, setBankName] = useState("");
  const [brokerName, setBrokerName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState<"max" | "disciplined">("disciplined");

  // Auto-fill from URL deep-link (e.g. clicked from /app/pipeline)
  useEffect(() => {
    const t = params?.get("ticker");
    const b = params?.get("bank");
    const k = params?.get("broker");
    if (t && !ticker) setTicker(t.toUpperCase());
    if (b && !bankName) setBankName(b);
    if (k && !brokerName) setBrokerName(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const [copied, setCopied] = useState<"email" | "subject" | null>(null);
  const [sendState, setSendState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; messageId: string }
    | { kind: "disabled" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const bidAmount = tone === "max" ? maxBid : safeBid;
  const bidCents = tone === "max" ? maxBidCentsPerDollar : safeBidCentsPerDollar;
  const tickerOrPool = ticker || "[ticker]";
  const bankLabel = bankName || "[bank]";
  const brokerLabel = brokerName || "[name]";

  const { subject, body } = useMemo(() => {
    const ctx = { ticker: tickerOrPool, bankName: bankLabel, signalLabel: "" };
    const subj = fillTemplate(
      `Bid — ${bankLabel} ${tickerOrPool ? `(${tickerOrPool})` : ""} · ${formatUSD(face)} face`,
      profile,
      ctx
    );
    const lines = [
      `Hi ${brokerLabel},`,
      ``,
      `Thanks for the tape. Our bid on the ${formatUSD(face)} face ${bankLabel}${tickerOrPool && tickerOrPool !== "[ticker]" ? ` (${tickerOrPool})` : ""} pool:`,
      ``,
      `  ${formatUSD(bidAmount)}  ·  ${formatPct(bidCents, 2)}/dollar`,
      ``,
      `Underwriting basis:`,
      `- Recovery model: ${formatPct(recoveryPct, 1)} over ${workoutYears} years`,
      `- Servicing fee: ${formatPct(servicerFeePct, 0)} via [SERVICER]`,
      `- Target IRR: ${formatPct(irrPct, 0)}`,
      ``,
      `Payment terms: wire on contract execution. Standard buybacks (BK, deceased, SCRA, disputes). 30-day inspection on random sample.`,
      ``,
      `This bid holds through [date]. Happy to walk through the model on a call if useful.`,
      ``,
      `Best,`,
      `[YOUR_NAME]`,
      `[FIRM]`,
      `[PHONE] · [EMAIL]`,
      `License [LICENSE]`,
    ];
    const filled = fillTemplate(lines.join("\n"), profile, ctx);
    return { subject: subj, body: filled };
  }, [
    profile,
    tickerOrPool,
    bankLabel,
    brokerLabel,
    bidAmount,
    bidCents,
    face,
    recoveryPct,
    workoutYears,
    servicerFeePct,
    irrPct,
    formatUSD,
    formatPct,
  ]);

  const copy = async (what: "email" | "subject") => {
    try {
      const text =
        what === "subject" ? subject : `Subject: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const submit = async () => {
    if (!recipient.trim()) return;
    setSendState({ kind: "sending" });
    try {
      const r = await fetch("/api/send-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient.trim(),
          subject,
          text: body,
          replyTo: profile.email || undefined,
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
      setSendState({ kind: "ok", messageId: data.providerMessageId || "" });
    } catch (err) {
      setSendState({ kind: "error", message: (err as Error).message });
    }
  };

  const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="rounded-xl p-5 md:p-6"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] uppercase">
            <span
              className="px-2 py-0.5 rounded-full text-[#1a0c00] font-semibold"
              style={{ background: "var(--gradient-primary)" }}
            >
              Send the bid
            </span>
          </div>
          <h3 className="mt-2 font-serif italic text-xl md:text-2xl text-[color:var(--color-fg)]">
            Reply to the broker with this bid.
          </h3>
          <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] max-w-2xl">
            Auto-filled from the calculator above + your profile. Pick which bid to
            send (disciplined leaves margin for surprises; max stretches it).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Field label="Ticker (optional)">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="WAL"
            className="w-full bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[13px] font-mono text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          />
        </Field>
        <Field label="Bank / pool name">
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Western Alliance Bancorporation"
            className="w-full bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          />
        </Field>
        <Field label="Broker first name (optional)">
          <input
            value={brokerName}
            onChange={(e) => setBrokerName(e.target.value)}
            placeholder="Alex"
            className="w-full bg-[color:var(--color-bg-soft)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[13px] text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mr-1">
          Bid:
        </span>
        <button
          type="button"
          onClick={() => setTone("disciplined")}
          className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition ${
            tone === "disciplined"
              ? "bg-[color:var(--color-accent)] text-[color:var(--color-bg)]"
              : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)]"
          }`}
        >
          Disciplined · {formatUSD(safeBid)} ({formatPct(safeBidCentsPerDollar, 2)}¢)
        </button>
        <button
          type="button"
          onClick={() => setTone("max")}
          className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full transition ${
            tone === "max"
              ? "bg-[color:var(--color-warn)] text-[color:var(--color-bg)]"
              : "border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-fg)]"
          }`}
        >
          Max · {formatUSD(maxBid)} ({formatPct(maxBidCentsPerDollar, 2)}¢)
        </button>
      </div>

      <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3 mb-4">
        <div className="font-mono text-[11px] text-[color:var(--color-fg-dim)] mb-2">
          <span className="text-[color:var(--color-fg-faint)]">Subject:</span> {subject}
        </div>
        <pre className="whitespace-pre-wrap font-mono text-[12px] text-[color:var(--color-fg)] leading-relaxed">
          {body}
        </pre>
      </div>

      <div className="flex items-stretch gap-2 flex-wrap mb-3">
        <input
          type="email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="broker@firm.com"
          className="flex-1 min-w-[220px] bg-[color:var(--color-bg-1)] border border-[color:var(--color-line)] rounded px-3 py-2 text-[12px] font-mono text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)] transition"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!recipient.trim() || sendState.kind === "sending"}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded text-[#1a0c00] hover:opacity-90 disabled:opacity-40 transition"
          style={{ background: "var(--gradient-primary)" }}
        >
          {sendState.kind === "sending" ? "Sending…" : "Send bid ⚡"}
        </button>
        <a
          href={mailto}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded border border-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition"
        >
          Open in mail ↗
        </a>
        <button
          type="button"
          onClick={() => copy("email")}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 rounded border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition"
        >
          {copied === "email" ? "Copied ✓" : "Copy"}
        </button>
      </div>

      {sendState.kind === "ok" && (
        <div className="rounded-lg border border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)] px-3 py-2 text-[12px] text-[color:var(--color-success)]">
          ✓ Bid sent. Move the deal to &ldquo;Bidding&rdquo; in <a href="/app/pipeline" className="underline">Pipeline</a>.
        </div>
      )}
      {sendState.kind === "disabled" && (
        <div className="rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-3 py-2 text-[12px] text-[color:var(--color-warn)]">
          Auto-send needs RESEND_API_KEY on the server. Use Copy or Open in mail for now.
        </div>
      )}
      {sendState.kind === "error" && (
        <div className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[12px] text-[color:var(--color-danger)]">
          Send failed: {sendState.message}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
          {label}
        </div>
        <div className="font-mono text-[15px] text-[color:var(--color-accent)] tick">
          {format(value)}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[color:var(--color-accent)]"
      />
    </div>
  );
}

function Result({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "strong" | "default";
}) {
  const color =
    tone === "strong"
      ? "text-[color:var(--color-accent)]"
      : tone === "ok"
      ? "text-[color:var(--color-fg)]"
      : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl tick ${color}`}>{value}</div>
      {sub && (
        <div className="mt-1 font-mono text-[11px] text-[color:var(--color-fg-faint)] tracking-[0.05em]">
          {sub}
        </div>
      )}
    </div>
  );
}
