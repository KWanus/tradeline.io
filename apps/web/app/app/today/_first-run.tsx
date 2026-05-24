"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Lightweight "have you started?" detection that runs on the client.
// We look at the localStorage keys the various boards write to. If any
// of them have content, we treat the workbase as "started" and hide the
// first-run hero. The signal is conservative: pipeline OR portfolio OR
// customers OR subscribers OR setup-progress is enough.
const STORAGE_KEYS = [
  "tradeline.pipeline.deals.v1",
  "tradeline.portfolio.holdings.v1",
  "tradeline.customers.v1",
  "tradeline.subscribers.v1",
  "tradeline.setup.checklist.v1",
  "tradeline.predictions.v1",
];

function hasStarted(): boolean {
  if (typeof window === "undefined") return true;
  for (const k of STORAGE_KEYS) {
    try {
      const v = window.localStorage.getItem(k);
      if (!v) continue;
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0)
        return true;
    } catch {}
  }
  return false;
}

export function FirstRunHero({ friendlyDate }: { friendlyDate: string }) {
  const [started, setStarted] = useState<boolean | null>(null);

  useEffect(() => {
    setStarted(hasStarted());
  }, []);

  // Don't flash anything until we know
  if (started === null) return null;
  if (started) return null;

  return (
    <section className="mb-12">
      {/* Welcome strip */}
      <div className="card-hero p-7 md:p-10 mb-6">
        <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Welcome · {friendlyDate}
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
          Two paths.{" "}
          <span className="italic text-gradient-accent">Pick one or run both.</span>
        </h1>
        <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-3xl">
          Tradeline is two businesses in one. <strong className="text-[color:var(--color-fg)]">Path A</strong>{" "}
          puts the SaaS live and starts taking subscriptions from licensed
          buyers, brokers, lenders, and attorneys — 4 steps, one day.{" "}
          <strong className="text-[color:var(--color-fg)]">Path B</strong> is
          the 12-month operator journey: license, deal, hypothecate, scale.
          Most founders run them in parallel.
        </p>
      </div>

      {/* The two paths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PathCard
          tag="Path A · this week"
          title="Sell Tradeline"
          subtitle="4 steps · 1 day · ~$18 all-in"
          body="The product is already built. Deploy it, wire email + data cron, send 20 intros, take the first subscription. Customers pay for the tool while you separately work on Path B."
          cta={{ label: "Take Path A — Go Live", href: "/app/launch" }}
          highlight
        />
        <PathCard
          tag="Path B · 12 months"
          title="Become a licensed buyer"
          subtitle="21 steps · 5 stages · ~$60k all-in"
          body="The full operator journey. Tradeline picked the best of every decision (state, servicer, bank, broker, lender, attorney, CPA). You follow the steps."
          cta={{ label: "Take Path B — Winning System", href: "/app/path" }}
        />
      </div>

      {/* Browse alternative */}
      <div className="mt-10 pt-8 border-t border-[color:var(--color-line)]">
        <div className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] mb-4">
          Or browse on your own
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile
            label="Read the primer"
            body="10-minute plain-English explainer of the entire debt-buying business."
            href="/app/learn"
          />
          <Tile
            label="Ask the AI tutor"
            body="Stuck on a term or a question? Claude Sonnet 4.6 answers in plain English."
            href="/app/tutor"
          />
          <Tile
            label="See today's radar"
            body="The 31 banks tracked, with this week's distress signals."
            href="/app/today"
            onSkip
          />
        </div>
        <div className="mt-5 flex items-center gap-1.5 text-[11px] text-[color:var(--color-fg-faint)]">
          <span className="kbd">⌘K</span>
          <span>opens quick nav from anywhere</span>
        </div>
      </div>
    </section>
  );
}

function PathCard({
  tag,
  title,
  subtitle,
  body,
  cta,
  highlight,
}: {
  tag: string;
  title: string;
  subtitle: string;
  body: string;
  cta: { label: string; href: string };
  highlight?: boolean;
}) {
  return (
    <Link
      href={cta.href}
      className={`block p-6 md:p-8 rounded-xl border transition group ${
        highlight
          ? "border-[color:var(--color-accent-dim)] bg-gradient-to-br from-[color:var(--color-bg-1)] via-[color:var(--color-bg-soft)] to-[color:var(--color-bg-1)] hover:border-[color:var(--color-accent)] hover:shadow-[0_14px_44px_-10px_rgba(var(--tint-accent-2-rgb),0.5)]"
          : "border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] hover:border-[color:var(--color-accent)]"
      }`}
    >
      <div
        className={`text-[11px] tracking-[0.18em] uppercase ${
          highlight ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-fg-faint)]"
        }`}
      >
        {tag}
      </div>
      <h3 className="mt-3 font-serif text-3xl md:text-4xl text-[color:var(--color-fg)] tracking-tight italic">
        {title}
      </h3>
      <div className="mt-2 text-[13px] text-[color:var(--color-fg-faint)] font-mono">
        {subtitle}
      </div>
      <p className="mt-4 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {body}
      </p>
      <div
        className={`mt-6 inline-flex items-center gap-2 text-[13px] font-medium ${
          highlight
            ? "text-[color:var(--color-accent)]"
            : "text-[color:var(--color-fg)]"
        }`}
      >
        {cta.label}{" "}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}

function Tile({
  label,
  body,
  href,
  onSkip,
}: {
  label: string;
  body: string;
  href: string;
  isInternal?: boolean;
  onSkip?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={
        onSkip
          ? () => {
              try {
                window.localStorage.setItem(
                  "tradeline.first_run_dismissed.v1",
                  "1"
                );
              } catch {}
            }
          : undefined
      }
      className="card p-4 lift-on-hover"
    >
      <div className="text-[14px] text-[color:var(--color-fg)] font-medium">
        {label}
      </div>
      <p className="mt-1.5 text-[12px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {body}
      </p>
    </Link>
  );
}

