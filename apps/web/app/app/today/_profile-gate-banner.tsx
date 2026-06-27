"use client";

import Link from "next/link";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

/**
 * Nudges the operator to complete their buyer profile, which personalizes every
 * outreach draft. Renders nothing once the profile is complete. Client-side
 * because the profile lives in localStorage.
 */
export function ProfileGateBanner() {
  const [profile] = useBuyerProfile();
  if (isProfileComplete(profile)) return null;

  return (
    <Link
      href="/app/profile"
      className="mb-6 flex items-center gap-3 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-bg-soft)] px-4 py-3 hover:border-[color:var(--color-accent)] transition"
    >
      <span aria-hidden className="text-[color:var(--color-warn)]">
        ⚑
      </span>
      <span className="text-[13px] text-[color:var(--color-fg-dim)] leading-snug">
        <strong className="text-[color:var(--color-fg)]">Finish your profile</strong> —
        firm, state, and asset focus auto-fill every outreach email so you&rsquo;re
        not editing placeholders. 60 seconds.
      </span>
      <span className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-accent)] whitespace-nowrap">
        Complete →
      </span>
    </Link>
  );
}
