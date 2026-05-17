"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";
import { readDeals, type Deal } from "@/lib/pipeline";
import { readOutreach, readWatchlist, type OutreachEvent } from "@/lib/bank-state";

type JourneyState = Record<string, boolean>;
type ReadinessState = Record<string, boolean>;
type LicenseStatus = "not-started" | "preparing" | "submitted" | "issued";

const JOURNEY_STEPS = [
  { id: "license", label: "License" },
  { id: "brokers", label: "Brokers" },
  { id: "first-deal", label: "First deal" },
  { id: "track-record", label: "Track record" },
  { id: "hypothecate", label: "Hypothecate" },
  { id: "diversify", label: "Diversify" },
];

const FUND_GATES = [
  { id: "ten-deals", label: "10 deals closed" },
  { id: "audited-years", label: "2 years audited" },
  { id: "underwriting-doc", label: "Underwriting documented" },
  { id: "servicing-msa", label: "Servicing MSA" },
  { id: "eando-insurance", label: "E&O insurance" },
  { id: "irr-15", label: "15%+ net IRR" },
  { id: "clean-compliance", label: "Clean compliance" },
  { id: "credibility", label: "Industry credibility" },
];

const LICENSE_STATES = [
  "DC",
  "MD",
  "VA",
  "WV",
  "DE",
  "PA",
  "NJ",
  "NY",
  "CT",
];

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function fmtPct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function daysAgo(d: number): Date {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return t;
}

export function ProgressDashboard() {
  const [profile] = useBuyerProfile();
  const [hydrated, setHydrated] = useState(false);

  // Live state pulled from localStorage on mount and on storage events.
  const [outreach, setOutreach] = useState<OutreachEvent[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [journey, setJourney] = useState<JourneyState>({});
  const [readiness, setReadiness] = useState<ReadinessState>({});
  const [licenseStatuses, setLicenseStatuses] = useState<
    Record<string, LicenseStatus>
  >({});

  const refresh = () => {
    if (typeof window === "undefined") return;
    setOutreach(readOutreach());
    setDeals(readDeals());
    setWatchlist(readWatchlist());
    try {
      const j = window.localStorage.getItem("tradeline.journey.v1");
      setJourney(j ? JSON.parse(j) : {});
    } catch {
      setJourney({});
    }
    try {
      const r = window.localStorage.getItem("tradeline.fund_readiness.v1");
      setReadiness(r ? JSON.parse(r) : {});
    } catch {
      setReadiness({});
    }
    const ls: Record<string, LicenseStatus> = {};
    for (const s of LICENSE_STATES) {
      try {
        const v = window.localStorage.getItem(`tradeline.license_status.v1.${s}`);
        if (
          v &&
          (v === "not-started" ||
            v === "preparing" ||
            v === "submitted" ||
            v === "issued")
        ) {
          ls[s] = v as LicenseStatus;
        }
      } catch {}
    }
    setLicenseStatuses(ls);
  };

  useEffect(() => {
    refresh();
    setHydrated(true);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const now = Date.now();
  const cutoff7 = daysAgo(7).getTime();
  const cutoff30 = daysAgo(30).getTime();

  const outreachStats = useMemo(() => {
    const all = outreach.length;
    const last7 = outreach.filter(
      (e) => new Date(e.sentAt).getTime() >= cutoff7
    ).length;
    const last30 = outreach.filter(
      (e) => new Date(e.sentAt).getTime() >= cutoff30
    ).length;
    const uniqueTickers = new Set(outreach.map((e) => e.ticker)).size;
    const brokerCounts: Record<string, number> = {};
    for (const e of outreach) {
      const k = e.brokerShortName || e.brokerName || "—";
      brokerCounts[k] = (brokerCounts[k] || 0) + 1;
    }
    const topBrokers = Object.entries(brokerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { all, last7, last30, uniqueTickers, topBrokers };
  }, [outreach, cutoff7, cutoff30]);

  const pipelineStats = useMemo(() => {
    const counts = {
      sourced: 0,
      reviewing: 0,
      underwriting: 0,
      bidding: 0,
      won: 0,
      lost: 0,
      walked: 0,
    };
    let openFace = 0;
    let wonFace = 0;
    for (const d of deals) {
      counts[d.stage] = (counts[d.stage] || 0) + 1;
      if (d.stage === "won") wonFace += d.faceValueUsd;
      else if (d.stage !== "lost" && d.stage !== "walked")
        openFace += d.faceValueUsd;
    }
    const open = counts.sourced + counts.reviewing + counts.underwriting + counts.bidding;
    const closed = counts.won + counts.lost + counts.walked;
    const winRate =
      closed === 0 ? 0 : Math.round((counts.won / closed) * 100);
    return {
      counts,
      open,
      closed,
      total: deals.length,
      openFace,
      wonFace,
      winRate,
    };
  }, [deals]);

  const journeyDone = JOURNEY_STEPS.filter((s) => journey[s.id]).length;
  const readinessDone = FUND_GATES.filter((g) => readiness[g.id]).length;
  const licenseIssued = Object.values(licenseStatuses).filter(
    (s) => s === "issued"
  ).length;
  const licenseInFlight = Object.values(licenseStatuses).filter(
    (s) => s === "preparing" || s === "submitted"
  ).length;

  // Replies-per-email proxy: pipeline deals divided by emails sent.
  const conversionPct =
    outreachStats.all === 0
      ? 0
      : Math.round((pipelineStats.total / outreachStats.all) * 100);

  const verdict = useMemo(() => {
    if (outreachStats.last7 === 0 && pipelineStats.open === 0) {
      return {
        tone: "warn" as const,
        title: "Nothing happening this week.",
        body: "Zero emails sent in 7 days, zero open deals. The system can't compound if you don't put at-bats on the board.",
      };
    }
    if (outreachStats.last7 < 5) {
      return {
        tone: "warn" as const,
        title: "Volume below threshold.",
        body: `${outreachStats.last7} emails last 7d. Aim for 5–10/week minimum. Brokers respond to consistency, not bursts.`,
      };
    }
    if (pipelineStats.open === 0 && outreachStats.last30 >= 10) {
      return {
        tone: "warn" as const,
        title: "Volume but no traction.",
        body: `${outreachStats.last30} emails last 30d but no open deals. Review your template — try the bid-tone variants, role-play a cold call with the tutor.`,
      };
    }
    if (journeyDone === 0) {
      return {
        tone: "neutral" as const,
        title: "You're at Year 1 of the journey.",
        body: "Start ticking off Step 1 — license — at /app/learn. The journey ladder is your master compass.",
      };
    }
    if (pipelineStats.counts.won > 0) {
      return {
        tone: "accent" as const,
        title: `${pipelineStats.counts.won} won deal${pipelineStats.counts.won === 1 ? "" : "s"} · keep compounding.`,
        body: `${fmtCurrency(pipelineStats.wonFace)} face acquired. Track recovery in /app/portfolio. Brokers care about repeat — keep your existing relationships warm.`,
      };
    }
    return {
      tone: "accent" as const,
      title: "On the board.",
      body: `${outreachStats.last7} emails this week · ${pipelineStats.open} open deal${pipelineStats.open === 1 ? "" : "s"}. Keep the pipeline filling.`,
    };
  }, [outreachStats, pipelineStats, journeyDone]);

  if (!hydrated) {
    return (
      <div className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] px-6 py-10 text-center text-[13px] text-[color:var(--color-fg-dim)]">
        Loading your stats…
      </div>
    );
  }

  const profileOk = isProfileComplete(profile);

  return (
    <div className="space-y-8">
      {/* HEADLINE VERDICT */}
      <section
        className="rounded-xl p-6"
        style={{
          background:
            verdict.tone === "warn"
              ? "var(--color-warn-soft)"
              : verdict.tone === "accent"
                ? "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box"
                : "var(--color-bg-1)",
          border:
            verdict.tone === "warn"
              ? "1px solid var(--color-warn)"
              : verdict.tone === "accent"
                ? "1.5px solid transparent"
                : "1px solid var(--color-line)",
        }}
      >
        <div
          className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
            verdict.tone === "warn"
              ? "text-[color:var(--color-warn)]"
              : verdict.tone === "accent"
                ? "text-[color:var(--color-accent)]"
                : "text-[color:var(--color-fg-faint)]"
          }`}
        >
          Where you stand
        </div>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-[color:var(--color-fg)]">
          {verdict.title}
        </h2>
        <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
          {verdict.body}
        </p>
      </section>

      {/* TOP-LINE METRICS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[color:var(--color-line)] border border-[color:var(--color-line)] rounded-lg overflow-hidden">
        <Metric
          label="Emails · last 7d"
          value={outreachStats.last7.toString()}
          sub={`${outreachStats.last30} last 30d`}
          tone={outreachStats.last7 >= 5 ? "accent" : "warn"}
          href="/app/banks"
        />
        <Metric
          label="Open deals"
          value={pipelineStats.open.toString()}
          sub={fmtCurrency(pipelineStats.openFace) + " face"}
          tone="default"
          href="/app/pipeline"
        />
        <Metric
          label="Won · all time"
          value={pipelineStats.counts.won.toString()}
          sub={pipelineStats.wonFace > 0 ? fmtCurrency(pipelineStats.wonFace) + " face" : "—"}
          tone={pipelineStats.counts.won > 0 ? "accent" : "default"}
          href="/app/portfolio"
        />
        <Metric
          label="Conversion · email → deal"
          value={`${conversionPct}%`}
          sub={`${pipelineStats.total} deals / ${outreachStats.all} emails`}
          tone="default"
          href="/app/playbook"
        />
      </section>

      {/* OUTREACH BREAKDOWN */}
      <section className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            Outreach funnel
          </div>
          <Link
            href="/app/banks"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
          >
            Send more →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-px bg-[color:var(--color-line)]">
          <FunnelStep label="All time" value={outreachStats.all} />
          <FunnelStep label="Last 30d" value={outreachStats.last30} />
          <FunnelStep label="Last 7d" value={outreachStats.last7} accent />
        </div>
        <div className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
          {outreachStats.uniqueTickers} unique bank{outreachStats.uniqueTickers === 1 ? "" : "s"} contacted.
          {outreachStats.topBrokers.length > 0 ? " Top brokers:" : ""}
        </div>
        {outreachStats.topBrokers.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {outreachStats.topBrokers.map(([broker, count]) => (
              <span
                key={broker}
                className="font-mono text-[11px] tracking-[0.05em] px-2.5 py-1 rounded border border-[color:var(--color-line)] text-[color:var(--color-fg-dim)] bg-[color:var(--color-bg-soft)]"
              >
                {broker} <span className="text-[color:var(--color-accent)] ml-1">{count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* PIPELINE BREAKDOWN */}
      <section className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
            Pipeline state · {pipelineStats.total} total
          </div>
          <Link
            href="/app/pipeline"
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
          >
            Open pipeline →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-7 gap-px bg-[color:var(--color-line)]">
          <StageBox label="Sourced" count={pipelineStats.counts.sourced} />
          <StageBox label="Reviewing" count={pipelineStats.counts.reviewing} />
          <StageBox label="Underwriting" count={pipelineStats.counts.underwriting} />
          <StageBox label="Bidding" count={pipelineStats.counts.bidding} accent />
          <StageBox label="Won" count={pipelineStats.counts.won} success />
          <StageBox label="Lost" count={pipelineStats.counts.lost} dim />
          <StageBox label="Walked" count={pipelineStats.counts.walked} dim />
        </div>
        {pipelineStats.closed > 0 && (
          <div className="mt-4 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
            Win rate on closed deals:{" "}
            <span className="font-mono text-[color:var(--color-accent)]">
              {pipelineStats.winRate}%
            </span>{" "}
            ({pipelineStats.counts.won}/{pipelineStats.closed})
          </div>
        )}
      </section>

      {/* OPERATOR PROGRESS — journey + fund + licenses */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ProgressCard
          label="Operator journey"
          done={journeyDone}
          total={JOURNEY_STEPS.length}
          href="/app/learn"
          ctaLabel="Open ladder →"
          detail={
            <div className="mt-3 flex flex-wrap gap-1.5">
              {JOURNEY_STEPS.map((s) => (
                <span
                  key={s.id}
                  className={`font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 rounded ${
                    journey[s.id]
                      ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] border border-[color:var(--color-success-dim)]"
                      : "border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]"
                  }`}
                >
                  {s.label}
                </span>
              ))}
            </div>
          }
        />
        <ProgressCard
          label="Fund-readiness gates"
          done={readinessDone}
          total={FUND_GATES.length}
          href="/app/setup/fund"
          ctaLabel="Tick more →"
          detail={
            <div className="mt-3 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
              {readinessDone === 0
                ? "You're at Year 1. Operate first; the fund comes later."
                : readinessDone >= 5
                  ? "Pre-fund readiness. Begin talking to fund counsel."
                  : "Building the track record LPs actually inspect."}
            </div>
          }
        />
        <ProgressCard
          label="State licenses"
          done={licenseIssued}
          total={licenseInFlight + licenseIssued}
          customRatio={`${licenseIssued} issued · ${licenseInFlight} in-flight`}
          href="/app/setup/license"
          ctaLabel="Open playbooks →"
          detail={
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(licenseStatuses).map(([state, status]) => (
                <span
                  key={state}
                  className={`font-mono text-[10px] tracking-[0.05em] px-2 py-0.5 rounded ${
                    status === "issued"
                      ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)] border border-[color:var(--color-success-dim)]"
                      : status === "submitted"
                        ? "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] border border-[color:var(--color-accent-dim)]"
                        : status === "preparing"
                          ? "bg-[color:var(--color-warn-soft)] text-[color:var(--color-warn)] border border-[color:var(--color-warn)]"
                          : "border border-[color:var(--color-line)] text-[color:var(--color-fg-faint)]"
                  }`}
                >
                  {state}
                </span>
              ))}
              {Object.keys(licenseStatuses).length === 0 && (
                <span className="font-mono text-[11px] text-[color:var(--color-fg-faint)]">
                  No license filings started.
                </span>
              )}
            </div>
          }
        />
      </section>

      {/* SETUP STATE */}
      <section className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)] mb-4">
          Foundation
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FoundationRow
            label="Buyer profile"
            ok={profileOk}
            okCopy="Filled · auto-fills every template"
            warnCopy="Empty · scripts show [YOUR_NAME] placeholders"
            href="/app/profile"
          />
          <FoundationRow
            label="Watchlist"
            ok={watchlist.length > 0}
            okCopy={`${watchlist.length} bank${watchlist.length === 1 ? "" : "s"} starred`}
            warnCopy="Star banks to track them across pages"
            href="/app/banks"
          />
          <FoundationRow
            label="Brokers contacted"
            ok={outreachStats.topBrokers.length >= 3}
            okCopy={`${outreachStats.topBrokers.length} broker${outreachStats.topBrokers.length === 1 ? "" : "s"} engaged`}
            warnCopy="Aim for ≥3 broker relationships in your first quarter"
            href="/app/brokers"
          />
        </div>
      </section>

      <p className="text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-fg-faint)] leading-relaxed">
        All counts read from browser localStorage in real time. Refresh = recompute.
        Multi-device sync requires Phase 2 auth + Postgres.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "accent" | "warn" | "default";
  href?: string;
}) {
  const color =
    tone === "accent"
      ? "text-[color:var(--color-accent)]"
      : tone === "warn"
        ? "text-[color:var(--color-warn)]"
        : "text-[color:var(--color-fg)]";
  const content = (
    <div className="bg-[color:var(--color-bg-1)] px-5 py-4 hover:bg-[color:var(--color-bg-2)] transition">
      <div className="font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-fg-faint)] uppercase">
        {label}
      </div>
      <div className={`mt-1 font-mono text-3xl ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] font-mono text-[color:var(--color-fg-faint)]">
        {sub}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function FunnelStep({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3 ${
        accent
          ? "bg-[color:var(--color-accent-soft)]"
          : "bg-[color:var(--color-bg-1)]"
      }`}
    >
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-2xl ${
          accent ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StageBox({
  label,
  count,
  accent,
  success,
  dim,
}: {
  label: string;
  count: number;
  accent?: boolean;
  success?: boolean;
  dim?: boolean;
}) {
  const tone = accent
    ? "text-[color:var(--color-accent)]"
    : success
      ? "text-[color:var(--color-success)]"
      : dim
        ? "text-[color:var(--color-fg-faint)]"
        : "text-[color:var(--color-fg)]";
  return (
    <div className="bg-[color:var(--color-bg-1)] px-3 py-3">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl ${tone}`}>{count}</div>
    </div>
  );
}

function ProgressCard({
  label,
  done,
  total,
  customRatio,
  href,
  ctaLabel,
  detail,
}: {
  label: string;
  done: number;
  total: number;
  customRatio?: string;
  href: string;
  ctaLabel: string;
  detail: React.ReactNode;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <article className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="font-mono text-2xl text-[color:var(--color-accent)]">
          {customRatio || `${done}/${total}`}
        </div>
        {!customRatio && total > 0 && (
          <span className="font-mono text-[11px] tracking-[0.05em] text-[color:var(--color-fg-faint)]">
            {pct}%
          </span>
        )}
      </div>
      {!customRatio && total > 0 && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-[color:var(--color-bg-2)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: "var(--gradient-primary)",
            }}
          />
        </div>
      )}
      {detail}
      <Link
        href={href}
        className="mt-4 inline-block font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] hover:underline"
      >
        {ctaLabel}
      </Link>
    </article>
  );
}

function FoundationRow({
  label,
  ok,
  okCopy,
  warnCopy,
  href,
}: {
  label: string;
  ok: boolean;
  okCopy: string;
  warnCopy: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition ${
        ok
          ? "border-[color:var(--color-success-dim)] bg-[color:var(--color-success-soft)]"
          : "border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)]"
      }`}
    >
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {label}
      </div>
      <div
        className={`mt-1 text-[13px] font-medium ${
          ok
            ? "text-[color:var(--color-success)]"
            : "text-[color:var(--color-warn)]"
        }`}
      >
        {ok ? `✓ ${okCopy}` : `! ${warnCopy}`}
      </div>
    </Link>
  );
}
