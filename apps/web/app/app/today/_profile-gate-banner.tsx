"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

/**
 * One profile, every template. Until the operator fills their buyer profile,
 * every outreach draft ships with [FIRM] / [YOUR_NAME] placeholders — so this
 * banner sits at the very top of Today nudging them to fill it once. Hidden
 * the moment the profile is complete.
 */
export function ProfileGateBanner() {
  const [profile] = useBuyerProfile();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || isProfileComplete(profile)) return null;

  return (
    <section className="mb-6 rounded-xl border border-[color:var(--color-warn)] bg-[color:var(--color-warn-soft)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="text-[16px] leading-none mt-0.5">⚠</span>
          <div>
            <div className="text-[14px] font-semibold text-[color:var(--color-warn)]">
              Fill your buyer profile to unlock one-click outreach
            </div>
            <p className="mt-0.5 text-[12px] text-[color:var(--color-fg-dim)] leading-snug max-w-xl">
              Drafts below still carry{" "}
              <code className="font-mono text-[11px]">[FIRM]</code> /{" "}
              <code className="font-mono text-[11px]">[YOUR_NAME]</code>{" "}
              placeholders. Type your firm name once and every template across the
              workbase fills itself.
            </p>
          </div>
        </div>
        <Link href="/app/profile" className="btn-primary shrink-0">
          Complete profile →
        </Link>
      </div>
    </section>
  );
}
