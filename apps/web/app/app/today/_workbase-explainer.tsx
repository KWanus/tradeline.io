"use client";

import { useEffect, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

const DISMISSED_KEY = "tradeline.workbase_explainer_dismissed.v1";

export function WorkbaseExplainer() {
  const [profile] = useBuyerProfile();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed === null) return null;
  if (dismissed) return null;
  // Don't compete with WelcomeBanner / ProfileBanner — they own pre-setup state.
  if (!isProfileComplete(profile)) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <section className="mb-8 rounded-2xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] p-6 md:p-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)]">
            This page is your daily workbase
          </div>
          <h2 className="mt-2 font-serif italic text-2xl md:text-3xl text-[color:var(--color-fg)] tracking-tight leading-tight">
            Open it every morning. Approve. Done.
          </h2>
          <p className="mt-2 text-[14px] text-[color:var(--color-fg-dim)] max-w-2xl leading-relaxed">
            The system does the hunting overnight so you don&rsquo;t have to.
            Your job is the 20 minutes of approvals — replies are where the
            money is, and only you can write those.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)] hover:text-[color:var(--color-fg)] transition px-2 py-1"
          aria-label="Got it — hide this"
        >
          Got it ×
        </button>
      </div>

      <ol className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Step
          n="01"
          title="Signals refresh"
          body="Every 6 hours the workers pull SEC filings, FDIC + NCUA call reports, and matched news. Fresh banks land in the inbox below."
          when="Auto · overnight"
        />
        <Step
          n="02"
          title="Drafts queue"
          body="For each distressed bank the system writes a profile-personalized outreach email — pre-filled with your firm name, license, servicer."
          when="Auto · ready when you wake up"
        />
        <Step
          n="03"
          title="You approve, it sends"
          body="One click per card sends via Resend. Replies land in your inbox — that's where the deal actually opens. The first response gets your full attention."
          when="Manual · ~20 min/day"
        />
      </ol>

      <p className="mt-5 text-[12px] text-[color:var(--color-fg-faint)] leading-relaxed">
        What you <em>can&rsquo;t</em> automate: replies. Auto-responding to a
        warm prospect kills the deal. Everything else runs on autopilot.
      </p>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  when,
}: {
  n: string;
  title: string;
  body: string;
  when: string;
}) {
  return (
    <li className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-soft)] p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] tracking-[0.18em] text-[color:var(--color-accent)]">
          {n}
        </span>
        <span className="font-serif text-[16px] text-[color:var(--color-fg)] tracking-tight">
          {title}
        </span>
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed">
        {body}
      </p>
      <div className="mt-3 font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
        {when}
      </div>
    </li>
  );
}
