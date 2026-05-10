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
    <section className="card-hero p-7 md:p-12 mb-12">
      <div className="text-[12px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        Welcome · {friendlyDate}
      </div>
      <h1 className="mt-4 font-serif text-4xl md:text-6xl tracking-tight leading-[0.95] text-[color:var(--color-fg)]">
        We picked the best of every decision.{" "}
        <span className="italic text-gradient-accent">You just follow the path.</span>
      </h1>
      <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
        Don&rsquo;t know this industry yet? Doesn&rsquo;t matter. Tradeline has
        already chosen the best state, servicer, bank, insurance carrier,
        attorney, broker, and lender for a brand-new operator. 21 steps across
        5 stages. ~12 months to a leveraged operator.
      </p>

      <div className="mt-10 flex items-center gap-4 flex-wrap">
        <Link href="/app/path" className="btn-mega">
          Take the Winning System
        </Link>
        <span className="text-[12px] text-[color:var(--color-fg-faint)]">
          ~12 mo · under $20k all-in · zero guesswork
        </span>
      </div>

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
            isInternal
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

