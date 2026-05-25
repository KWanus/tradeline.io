"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  daysUntil,
  expiredLicenses,
  expiringWithinDays,
  readLicenses,
  URGENT_EXPIRY_THRESHOLD_DAYS,
  type License,
} from "@/lib/compliance-licenses";

// Sticky-ish top banner on /app/today (and anywhere else mounted) that
// surfaces license urgency. Three states:
//   - Expired: red, "X licenses LAPSED — sends to these states blocked"
//   - Expiring < 30d: warn, "X licenses expire in <30d — renew now (30-60d to process)"
//   - Healthy: nothing renders
//
// Reads from the compliance board's localStorage. Pure client-side; safe
// to mount in any page without affecting server-rendered cards.

export function LicenseExpiryBanner() {
  const [licenses, setLicenses] = useState<License[] | null>(null);

  useEffect(() => {
    setLicenses(readLicenses());
  }, []);

  if (licenses === null) return null; // not hydrated yet — render nothing to avoid flash
  if (licenses.length === 0) return null; // no licenses configured — nothing to warn about

  const expired = expiredLicenses(licenses);
  const expiringUrgent = expiringWithinDays(licenses, URGENT_EXPIRY_THRESHOLD_DAYS);
  const expiringNonUrgent = expiringWithinDays(licenses, 90).filter(
    (l) => daysUntil(l.expirationDate) > URGENT_EXPIRY_THRESHOLD_DAYS
  );

  if (expired.length === 0 && expiringUrgent.length === 0 && expiringNonUrgent.length === 0) {
    return null;
  }

  // Priority: expired first, then expiring urgent.
  if (expired.length > 0) {
    return (
      <div className="mb-6 border border-[color:var(--color-danger)] bg-[color:var(--color-bg-1)] rounded-lg p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.18em] uppercase font-semibold shrink-0"
            style={{ background: "var(--color-danger)", color: "var(--color-bg)" }}
          >
            {expired.length} LAPSED
          </span>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              <strong className="text-[color:var(--color-danger)]">
                {expired.length} state {expired.length === 1 ? "license has" : "licenses have"}{" "}
                expired.
              </strong>{" "}
              The compliance shield will block outreach sends to these states:{" "}
              <span className="font-mono">
                {expired.slice(0, 6).map((l) => l.state).join(", ")}
                {expired.length > 6 && ` +${expired.length - 6} more`}
              </span>
              .
            </p>
            {expiringUrgent.length > 0 && (
              <p className="mt-1 text-[12.5px] text-[color:var(--color-warn)]">
                Plus {expiringUrgent.length} expiring in &lt;{URGENT_EXPIRY_THRESHOLD_DAYS}d.
              </p>
            )}
          </div>
          <Link
            href="/app/compliance"
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            Renew at /app/compliance →
          </Link>
        </div>
      </div>
    );
  }

  if (expiringUrgent.length > 0) {
    return (
      <div className="mb-6 border border-[color:var(--color-warn)] bg-[color:var(--color-bg-1)] rounded-lg p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-[0.18em] uppercase font-semibold shrink-0"
            style={{ background: "var(--color-warn)", color: "var(--color-bg)" }}
          >
            {expiringUrgent.length} URGENT
          </span>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[14px] text-[color:var(--color-fg)] leading-relaxed">
              <strong className="text-[color:var(--color-warn)]">
                {expiringUrgent.length} state{expiringUrgent.length === 1 ? "" : "s"}{" "}
                expiring in &lt;{URGENT_EXPIRY_THRESHOLD_DAYS} days.
              </strong>{" "}
              Most states take 30-60 days to renew — start now or sends will block when
              they lapse.
            </p>
            <ul className="mt-2 space-y-0.5 text-[12px] font-mono text-[color:var(--color-fg-dim)]">
              {expiringUrgent.slice(0, 5).map((l) => {
                const d = daysUntil(l.expirationDate);
                return (
                  <li key={l.id}>
                    <span className="text-[color:var(--color-warn)]">{l.state}</span> ·{" "}
                    {l.licenseType} · expires in {d}d ({l.expirationDate})
                  </li>
                );
              })}
              {expiringUrgent.length > 5 && (
                <li className="text-[color:var(--color-fg-faint)]">
                  +{expiringUrgent.length - 5} more at /app/compliance
                </li>
              )}
            </ul>
          </div>
          <Link
            href="/app/compliance"
            className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-full text-[#0a0c14] hover:opacity-90 transition shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            Open compliance →
          </Link>
        </div>
      </div>
    );
  }

  // Non-urgent expiring (30-90d) — quieter notice
  return (
    <div className="mb-6 border border-[color:var(--color-line-strong)] bg-[color:var(--color-bg-1)] rounded-lg p-3">
      <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-faint)]">
          Compliance heads-up
        </span>
        <span className="text-[color:var(--color-fg-dim)]">
          {expiringNonUrgent.length} {expiringNonUrgent.length === 1 ? "license" : "licenses"}{" "}
          expiring this quarter (
          <span className="font-mono">{expiringNonUrgent.map((l) => l.state).join(", ")}</span>).
        </span>
        <Link
          href="/app/compliance"
          className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-[color:var(--color-fg-dim)] hover:text-[color:var(--color-accent)] transition"
        >
          Review →
        </Link>
      </div>
    </div>
  );
}
