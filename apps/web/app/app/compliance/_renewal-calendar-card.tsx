"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COMPLIANCE_LICENSES_STORAGE_KEY,
  readLicenses,
  type License,
} from "@/lib/compliance-licenses";
import {
  buildLicenseRenewalEvents,
  downloadLicenseRenewalIcs,
} from "@/lib/license-renewal-calendar";

// Drop license renewal reminders into Google / Apple / Outlook calendar
// as .ics events. The in-app next-move card already nags about renewals,
// but operators don't open the app every day — calendar events fire
// outside the OS. Two events per license inside the 12-month horizon:
// "start renewal" (-45d) and "expires" (hard deadline).

export function RenewalCalendarCard() {
  const [hydrated, setHydrated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === COMPLIANCE_LICENSES_STORAGE_KEY || e.key === null) {
        setRefreshKey((k) => k + 1);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const licenses = useMemo<License[]>(() => {
    if (!hydrated) return [];
    return readLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, refreshKey]);

  const counts = useMemo(() => {
    if (!hydrated) return null;
    return buildLicenseRenewalEvents(licenses).counts;
  }, [licenses, hydrated]);

  if (!hydrated || !counts || counts.totalEvents === 0) return null;

  function exportNow() {
    setBusy(true);
    setMessage(null);
    const r = downloadLicenseRenewalIcs(licenses);
    if (r.ok) {
      setMessage(
        `✓ Downloaded ${r.counts.totalEvents} calendar event${r.counts.totalEvents === 1 ? "" : "s"} — open the .ics file in your calendar app`
      );
    } else {
      setMessage("✗ No events to export");
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-bg-1)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-fg-faint)]">
            Renewal calendar
          </div>
          <h3 className="mt-1 text-base font-semibold text-[color:var(--color-fg)]">
            Drop renewal reminders into your calendar
          </h3>
          <p className="mt-1.5 text-[13px] text-[color:var(--color-fg-dim)] leading-relaxed max-w-2xl">
            One .ics file with two events per license: "Start renewal" 45 days
            before expiry (state processing takes 30-60d) and "License expires"
            on the deadline itself. Import once and Google / Apple / Outlook
            will remind you outside Tradeline.
          </p>
        </div>
        <button
          type="button"
          onClick={exportNow}
          disabled={busy}
          className="font-mono text-xs tracking-[0.2em] uppercase px-4 py-2.5 rounded-full border border-[color:var(--color-line-strong)] text-[color:var(--color-fg-dim)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {busy ? "…" : "Download .ics"}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-4 flex-wrap font-mono text-[11px] text-[color:var(--color-fg-dim)]">
        <span>
          <span className="text-[color:var(--color-fg)]">{counts.totalEvents}</span>{" "}
          event{counts.totalEvents === 1 ? "" : "s"}
        </span>
        <span>
          <span className="text-[color:var(--color-fg)]">{counts.startEvents}</span>{" "}
          start-renewal
        </span>
        <span>
          <span className="text-[color:var(--color-fg)]">{counts.expiryEvents}</span>{" "}
          deadline
        </span>
        {counts.skippedAlreadyExpired > 0 && (
          <span className="text-[color:var(--color-warn)]">
            {counts.skippedAlreadyExpired} already expired (skipped)
          </span>
        )}
        {counts.skippedBeyondHorizon > 0 && (
          <span className="text-[color:var(--color-fg-faint)]">
            {counts.skippedBeyondHorizon} {">"}1y out (skipped)
          </span>
        )}
        {message && (
          <span
            className={
              message.startsWith("✓")
                ? "text-[color:var(--color-success)]"
                : "text-[color:var(--color-danger)]"
            }
          >
            {message}
          </span>
        )}
      </div>
    </section>
  );
}
