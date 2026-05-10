"use client";

import Link from "next/link";
import { isProfileComplete, useBuyerProfile } from "@/lib/buyer-profile";

export function ProfileBanner() {
  const [profile] = useBuyerProfile();
  if (isProfileComplete(profile)) return null;

  return (
    <div className="mb-6 rounded-lg border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-warn)]" />
        <span className="text-[13px] text-[color:var(--color-fg)] leading-snug">
          <strong>Fill your buyer profile once</strong> — it auto-fills every
          broker email, response template, playbook script, and the AI tutor.
          Takes 2 minutes.
        </span>
      </div>
      <Link
        href="/app/profile"
        className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded bg-[color:var(--color-accent)] text-[color:var(--color-bg)] hover:opacity-90 transition"
      >
        Fill profile →
      </Link>
    </div>
  );
}
