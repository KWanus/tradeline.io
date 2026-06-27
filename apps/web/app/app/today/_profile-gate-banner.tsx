"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { isProfileComplete, readProfile } from "@/lib/buyer-profile";

/**
 * Nudges the operator to finish their buyer profile. Until name / firm / state
 * / asset focus are set, outreach templates fill with empty placeholders — so
 * this banner sits at the top of Today until the profile is complete, then
 * disappears. Reads localStorage only; renders nothing during SSR/first paint
 * to avoid a hydration flash.
 */
export function ProfileGateBanner() {
  const [hydrated, setHydrated] = useState(false);
  const [complete, setComplete] = useState(true);

  useEffect(() => {
    setComplete(isProfileComplete(readProfile()));
    setHydrated(true);

    const onChange = () => setComplete(isProfileComplete(readProfile()));
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
  }, []);

  if (!hydrated || complete) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-warn)]">
            Finish setup
          </div>
          <h3 className="mt-1 text-[16px] font-semibold text-[color:var(--color-fg)]">
            Your buyer profile is incomplete.
          </h3>
          <p className="mt-1 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-xl">
            Outreach drafts fill from your profile — name, firm, state, and asset
            focus. Add them once and every email, template, and signature fills
            itself.
          </p>
        </div>
        <Link href="/app/profile" className="btn-primary shrink-0">
          Complete profile →
        </Link>
      </div>
    </div>
  );
}
