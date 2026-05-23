"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CreditBand,
  type LeadSource,
  type Referral,
  type ReferralStatus,
  type SourceStat,
  CREDIT_BAND_LABEL,
  LEAD_SOURCE_LABEL,
  LEAD_SOURCE_ORDER,
  PRODUCT_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  programByShortName,
  readReferrals,
  scoreReferral,
  sourcePerformance,
  writeReferrals,
} from "@/lib/referrals";

function newId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function parseNum(s: string): number {
  const n = Number(String(s).replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const BAND_TONE: Record<string, string> = {
  strong: "text-[color:var(--color-success)]",
  workable: "text-[color:var(--color-warn)]",
  weak: "text-[color:var(--color-danger)]",
};
const BAND_LABEL: Record<string, string> = {
  strong: "Strong — place it",
  workable: "Workable — submit",
  weak: "Weak — not referable yet",
};

const inputCls =
  "px-3 py-2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] text-[13px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-faint)] focus:outline-none focus:border-[color:var(--color-accent)]";

export function ReferralDesk() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReferrals(readReferrals());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeReferrals(referrals);
  }, [referrals, hydrated]);

  const totals = useMemo(() => {
    let pipeline = 0;
    let earned = 0;
    let active = 0;
    for (const r of referrals) {
      if (r.status === "funded") {
        earned += r.commissionUsd || 0;
      } else if (r.status !== "declined") {
        active += 1;
        const s = scoreReferral(r);
        pipeline += s.estCommissionUsd;
      }
    }
    return { pipeline, earned, active };
  }, [referrals]);

  const sources = useMemo(() => sourcePerformance(referrals), [referrals]);

  if (!hydrated) return null;

  const update = (id: string, patch: Partial<Referral>) =>
    setReferrals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  const remove = (id: string) =>
    setReferrals((prev) => prev.filter((r) => r.id !== id));

  const sorted = [...referrals].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return (
    <section className="mt-2">
      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat
          label="Pipeline (est. fees)"
          value={formatUSD(totals.pipeline)}
        />
        <SummaryStat
          label="Earned — funded"
          value={formatUSD(totals.earned)}
          tone="ok"
        />
        <SummaryStat label="Active leads" value={String(totals.active)} />
      </div>

      <AddReferralForm
        onAdd={(r) => setReferrals((prev) => [r, ...prev])}
      />

      {sources.length > 0 && <SourcePerformance stats={sources} />}

      {sorted.length === 0 ? (
        <p className="mt-8 text-[13px] text-[color:var(--color-fg-faint)] font-mono">
          No leads yet. Log a business above — the desk scores it and tells you
          which lender to send it to.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {sorted.map((r) => (
            <ReferralCard
              key={r.id}
              referral={r}
              onUpdate={(patch) => update(r.id, patch)}
              onRemove={() => remove(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok";
}) {
  return (
    <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-[18px] ${
          tone === "ok"
            ? "text-[color:var(--color-success)]"
            : "text-[color:var(--color-fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SourcePerformance({ stats }: { stats: SourceStat[] }) {
  const topEarner = stats.find((s) => s.earnedUsd > 0);
  // Channels with real volume that have never funded — candidates to drop.
  const dead = stats.filter((s) => s.total >= 3 && s.funded === 0);

  return (
    <div className="mt-5 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Where your deals come from
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
        Which channel actually pays. Double down on what funds — drop what
        doesn&rsquo;t.
      </p>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[440px]">
          <div className="grid grid-cols-[1.4fr_repeat(4,0.8fr)] gap-2 px-2 pb-1 font-mono text-[9px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)]">
            <span>Channel</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Funded</span>
            <span className="text-right">Close</span>
            <span className="text-right">Earned</span>
          </div>
          <div className="divide-y divide-[color:var(--color-line)] rounded-md border border-[color:var(--color-line)]">
            {stats.map((s) => {
              const isTop = topEarner?.source === s.source && s.earnedUsd > 0;
              return (
                <div
                  key={s.source}
                  className="grid grid-cols-[1.4fr_repeat(4,0.8fr)] gap-2 px-2 py-2 text-[12px] items-center"
                >
                  <span
                    className={
                      isTop
                        ? "text-[color:var(--color-success)] font-medium"
                        : "text-[color:var(--color-fg)]"
                    }
                  >
                    {LEAD_SOURCE_LABEL[s.source]}
                    {isTop && " ★"}
                  </span>
                  <span className="text-right font-mono text-[color:var(--color-fg-dim)]">
                    {s.total}
                  </span>
                  <span className="text-right font-mono text-[color:var(--color-fg-dim)]">
                    {s.funded}
                  </span>
                  <span className="text-right font-mono text-[color:var(--color-fg-dim)]">
                    {Math.round(s.closeRate * 100)}%
                  </span>
                  <span
                    className={`text-right font-mono ${
                      s.earnedUsd > 0
                        ? "text-[color:var(--color-success)]"
                        : "text-[color:var(--color-fg-faint)]"
                    }`}
                  >
                    {formatUSD(s.earnedUsd)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {topEarner && (
        <p className="mt-3 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
          <span className="text-[color:var(--color-success)]">
            {LEAD_SOURCE_LABEL[topEarner.source]}
          </span>{" "}
          has paid the most — that&rsquo;s where your next leads should come
          from.
        </p>
      )}
      {dead.length > 0 && (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-fg-faint)] leading-snug">
          {dead.map((s) => LEAD_SOURCE_LABEL[s.source]).join(", ")} —{" "}
          {dead.length === 1 ? "has" : "have"} leads but zero funded. Not worth
          the time yet.
        </p>
      )}
    </div>
  );
}

function AddReferralForm({ onAdd }: { onAdd: (r: Referral) => void }) {
  const [business, setBusiness] = useState("");
  const [contact, setContact] = useState("");
  const [months, setMonths] = useState("");
  const [revenue, setRevenue] = useState("");
  const [amount, setAmount] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");
  const [creditBand, setCreditBand] = useState<CreditBand>("unknown");
  const [source, setSource] = useState<LeadSource>("network");

  const monthsInBusiness = parseNum(months);
  const monthlyRevenueUsd = parseNum(revenue);
  const amountNeededUsd = parseNum(amount);

  // Live preview so the operator sees fundability before committing the lead.
  const preview = useMemo(
    () =>
      scoreReferral({
        monthsInBusiness,
        monthlyRevenueUsd,
        amountNeededUsd,
        creditBand,
      }),
    [monthsInBusiness, monthlyRevenueUsd, amountNeededUsd, creditBand]
  );

  const ready = business.trim() && amountNeededUsd > 0;

  const submit = () => {
    if (!ready) return;
    onAdd({
      id: newId(),
      business: business.trim(),
      contact: contact.trim(),
      monthsInBusiness,
      monthlyRevenueUsd,
      amountNeededUsd,
      useOfFunds: useOfFunds.trim(),
      creditBand,
      source,
      status: preview.matches.length > 0 ? "matched" : "lead",
      // Pre-route to the best-payout match so the next action is obvious.
      lenderShortName: preview.matches[0]?.program.shortName ?? "",
      fundedAmountUsd: 0,
      commissionUsd: 0,
      note: "",
      createdAt: new Date().toISOString(),
    });
    setBusiness("");
    setContact("");
    setMonths("");
    setRevenue("");
    setAmount("");
    setUseOfFunds("");
    setCreditBand("unknown");
    setSource("network");
  };

  return (
    <div className="mt-5 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
        Log a business borrower
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Business name"
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Contact (name / phone / email)"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder="Months in business"
          value={months}
          onChange={(e) => setMonths(e.target.value)}
        />
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder="Monthly revenue ($)"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
        />
        <input
          className={inputCls}
          inputMode="numeric"
          placeholder="Amount needed ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className={inputCls}
          value={creditBand}
          onChange={(e) => setCreditBand(e.target.value as CreditBand)}
        >
          {(Object.keys(CREDIT_BAND_LABEL) as CreditBand[]).map((b) => (
            <option key={b} value={b}>
              {CREDIT_BAND_LABEL[b]}
            </option>
          ))}
        </select>
        <label className="md:col-span-2 flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)] shrink-0">
            Lead source
          </span>
          <select
            className={`${inputCls} flex-1`}
            value={source}
            onChange={(e) => setSource(e.target.value as LeadSource)}
          >
            {LEAD_SOURCE_ORDER.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <input
          className={`${inputCls} md:col-span-2`}
          placeholder="What's the money for? (equipment, payroll, inventory…)"
          value={useOfFunds}
          onChange={(e) => setUseOfFunds(e.target.value)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[12px] text-[color:var(--color-fg-dim)]">
          {amountNeededUsd > 0 ? (
            <>
              <span className={`font-mono ${BAND_TONE[preview.band]}`}>
                {BAND_LABEL[preview.band]}
              </span>{" "}
              · score {preview.score} · {preview.matches.length} lender
              {preview.matches.length === 1 ? "" : "s"} fit · est. fee{" "}
              <span className="font-mono text-[color:var(--color-fg)]">
                {formatUSD(preview.estCommissionUsd)}
              </span>
            </>
          ) : (
            <span className="text-[color:var(--color-fg-faint)] font-mono">
              Enter an amount to see fundability
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="font-mono text-[10px] tracking-[0.18em] uppercase px-4 py-2 rounded-full border border-[color:var(--color-line-strong)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add to desk
        </button>
      </div>
    </div>
  );
}

function ReferralCard({
  referral,
  onUpdate,
  onRemove,
}: {
  referral: Referral;
  onUpdate: (patch: Partial<Referral>) => void;
  onRemove: () => void;
}) {
  const score = useMemo(() => scoreReferral(referral), [referral]);
  const routed = programByShortName(referral.lenderShortName);

  return (
    <article className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-xl tracking-tight text-[color:var(--color-fg)]">
            {referral.business}
          </h3>
          <div className="mt-0.5 font-mono text-[11px] text-[color:var(--color-fg-faint)]">
            {referral.contact || "no contact"} · {referral.monthsInBusiness}mo
            in business · {formatUSD(referral.monthlyRevenueUsd)}/mo ·{" "}
            {CREDIT_BAND_LABEL[referral.creditBand]} ·{" "}
            {LEAD_SOURCE_LABEL[referral.source] ?? "Other"}
          </div>
        </div>
        <span
          className={`font-mono text-[11px] tracking-[0.16em] uppercase ${BAND_TONE[score.band]}`}
        >
          {BAND_LABEL[score.band]} · {score.score}
        </span>
      </div>

      {referral.useOfFunds && (
        <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)]">
          Needs {formatUSD(referral.amountNeededUsd)} for {referral.useOfFunds}.
        </p>
      )}

      {score.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12px] text-[color:var(--color-fg-faint)] list-disc pl-5">
          {score.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {/* Routing */}
      {score.matches.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-3">
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
            Route to lender partner
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <select
              className={inputCls}
              value={referral.lenderShortName}
              onChange={(e) =>
                onUpdate({ lenderShortName: e.target.value })
              }
            >
              {score.matches.map((m) => (
                <option key={m.program.shortName} value={m.program.shortName}>
                  {m.program.shortName} — {PRODUCT_LABEL[m.program.product]} ·
                  est. {formatUSD(m.estCommissionUsd)}
                </option>
              ))}
            </select>
            {routed && (
              <a
                href={routed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-accent)] hover:underline"
              >
                Open {routed.shortName} ↗
              </a>
            )}
          </div>
          {routed && (
            <p className="mt-2 text-[12px] text-[color:var(--color-fg-dim)] leading-snug">
              {routed.commissionLabel}. {routed.payout}.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-[color:var(--color-fg-faint)] font-mono">
          No lender minimums met yet — keep the contact warm and revisit when
          revenue or tenure grows.
        </p>
      )}

      {/* Status + payout */}
      <div className="mt-4 flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
            Status
          </span>
          <select
            className={inputCls}
            value={referral.status}
            onChange={(e) =>
              onUpdate({ status: e.target.value as ReferralStatus })
            }
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        {referral.status === "funded" && (
          <>
            <label className="block">
              <span className="block font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
                Amount funded ($)
              </span>
              <input
                className={`${inputCls} w-32`}
                inputMode="numeric"
                value={referral.fundedAmountUsd || ""}
                placeholder="0"
                onChange={(e) =>
                  onUpdate({ fundedAmountUsd: parseNum(e.target.value) })
                }
              />
            </label>
            <label className="block">
              <span className="block font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-1">
                Commission paid ($)
              </span>
              <input
                className={`${inputCls} w-32`}
                inputMode="numeric"
                value={referral.commissionUsd || ""}
                placeholder="0"
                onChange={(e) =>
                  onUpdate({ commissionUsd: parseNum(e.target.value) })
                }
              />
            </label>
          </>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="ml-auto font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-warn)] transition"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
