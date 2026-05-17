"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

const WELCOME_DONE_KEY = "tradeline.welcome_completed.v1";

export function WelcomeBanner() {
  const [profile] = useBuyerProfile();
  const [wizardDone, setWizardDone] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setWizardDone(window.localStorage.getItem(WELCOME_DONE_KEY) === "1");
    } catch {
      setWizardDone(false);
    }
  }, []);

  if (wizardDone === null) return null; // pre-hydration
  if (wizardDone) return null;
  if (isProfileComplete(profile)) return null; // profile complete = effectively done

  return (
    <div
      className="mb-6 rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap"
      style={{
        background:
          "linear-gradient(var(--color-bg-1), var(--color-bg-1)) padding-box, var(--gradient-primary) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-accent)] mb-1">
          New here · 5-minute setup
        </div>
        <h3 className="font-serif italic text-xl md:text-2xl text-[color:var(--color-fg)] tracking-tight">
          Take the welcome wizard.
        </h3>
        <p className="mt-1 text-[12px] text-[color:var(--color-fg-dim)] leading-snug max-w-xl">
          4 screens. Tradeline picks the right bank, fills the email, sends it, and
          schedules the day-7 + day-14 follow-up reminders to your inbox. Skip to{" "}
          <strong className="text-[color:var(--color-fg)]">/app/today</strong> after.
        </p>
      </div>
      <Link href="/app/welcome" className="btn-primary">
        Start setup
      </Link>
    </div>
  );
}
