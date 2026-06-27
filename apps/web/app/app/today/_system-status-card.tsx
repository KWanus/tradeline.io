"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { isProfileComplete, readProfile } from "@/lib/buyer-profile";

/**
 * Compact "is the machine ready" card. Checks the few client-visible setup
 * signals — profile complete, autopilot auth token saved, compliance licenses
 * entered — and shows what's left. All checks read localStorage only; this is
 * a nudge surface, not an authoritative server health check. When everything
 * is green the card collapses to a single reassuring line.
 */

const AUTOPILOT_TOKEN_KEY = "tradeline.autopilot_token.v1";
const LICENSES_KEY = "tradeline.compliance.licenses.v1";

type Check = { ok: boolean; label: string; href: string; fix: string };

export function SystemStatusCard() {
  const [hydrated, setHydrated] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    const profileOk = isProfileComplete(readProfile());
    let tokenOk = false;
    let licensesOk = false;
    try {
      tokenOk = Boolean(window.localStorage.getItem(AUTOPILOT_TOKEN_KEY));
      const raw = window.localStorage.getItem(LICENSES_KEY);
      licensesOk = Boolean(raw && Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length > 0);
    } catch {}

    setChecks([
      {
        ok: profileOk,
        label: "Buyer profile",
        href: "/app/profile",
        fix: "Add name, firm, state, asset focus",
      },
      {
        ok: tokenOk,
        label: "Autopilot authorized",
        href: "/app/autopilot",
        fix: "Paste your CRON_SECRET once",
      },
      {
        ok: licensesOk,
        label: "Compliance licenses",
        href: "/app/compliance",
        fix: "Log at least one state license",
      },
    ]);
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  const pending = checks.filter((c) => !c.ok);
  if (pending.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-2 text-[12px] font-mono tracking-[0.05em] text-[color:var(--color-success)]">
        <span aria-hidden>●</span> System ready — profile, autopilot, and
        compliance are all set.
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)] mb-3">
        Setup · {checks.length - pending.length}/{checks.length} ready
      </div>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-3 text-[13px]">
            <span
              className={
                c.ok
                  ? "text-[color:var(--color-success)]"
                  : "text-[color:var(--color-fg-faint)]"
              }
              aria-hidden
            >
              {c.ok ? "●" : "○"}
            </span>
            <span
              className={
                c.ok ? "text-[color:var(--color-fg-dim)]" : "text-[color:var(--color-fg)]"
              }
            >
              {c.label}
            </span>
            {!c.ok && (
              <Link
                href={c.href}
                className="ml-auto font-mono text-[10px] tracking-[0.16em] uppercase text-[color:var(--color-accent)] hover:underline"
              >
                {c.fix} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
