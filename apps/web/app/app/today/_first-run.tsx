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
        Your workbase, in{" "}
        <span className="italic text-gradient-accent">three steps</span>.
      </h1>
      <p className="mt-5 text-[color:var(--color-fg-dim)] text-lg leading-relaxed max-w-2xl">
        Tradeline is the operating system for buying and brokering distressed
        debt. You don&rsquo;t need to know any of this — it teaches you as you
        go. Three things to do right now:
      </p>

      <ol className="mt-9 space-y-4">
        <Step
          n="1"
          title="Read &ldquo;How this works&rdquo;"
          body="A 10-minute guide to the entire debt-buying business — every player, every step, every piece of vocabulary. Written for someone who has never heard of this."
          href="/app/learn"
          cta="Open the guide"
        />
        <Step
          n="2"
          title="Walk the Setup checklist"
          body="The 19 things you need to do to actually operate. State licensing, LLC formation, banking, surety bond, attorney, CPA. Tradeline tracks your progress; you click links."
          href="/app/setup"
          cta="Start the checklist"
        />
        <Step
          n="3"
          title="Ask the AI tutor anything"
          body="Claude Sonnet 4.6 trained on the entire Tradeline + debt-buying knowledge base. Stuck on a term, a state, or a math question? Just ask in plain English."
          href="/app/tutor"
          cta="Open the tutor"
        />
      </ol>

      <div className="mt-10 flex items-center gap-3 flex-wrap text-[12px] text-[color:var(--color-fg-faint)]">
        <span>Already exploring?</span>
        <Link
          href="/app/today"
          onClick={() => {
            // Mark first-run as done — any future visit shows the normal Today
            try {
              window.localStorage.setItem(
                "tradeline.first_run_dismissed.v1",
                "1"
              );
              window.location.reload();
            } catch {}
          }}
          className="btn-ghost text-[11px]"
        >
          Skip to the radar →
        </Link>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="kbd">⌘K</span> jump anywhere
        </span>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  href,
  cta,
}: {
  n: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="card p-5 md:p-6 lift-on-hover">
      <Link href={href} className="flex items-start gap-5">
        <span className="font-serif text-[44px] md:text-[56px] text-[color:var(--color-accent)] leading-[0.85] tick">
          {n}
        </span>
        <div className="flex-1">
          <div className="font-serif italic text-[20px] md:text-[22px] text-[color:var(--color-fg)] tracking-tight">
            {title}
          </div>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] leading-relaxed">
            {body}
          </p>
          <div className="mt-3 font-mono text-[11px] tracking-[0.16em] uppercase text-[color:var(--color-accent)] flex items-center gap-2">
            {cta} <span>→</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
