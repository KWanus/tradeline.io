"use client";

// License renewal calendar — for each active license with an expiration
// date, emit two .ics events the operator can drop into Google /
// Apple Calendar:
//
//   1. "Start renewal" at expirationDate − 45 days (state processing
//      usually takes 30-60d, so 45d gives the operator headroom).
//   2. "License expires" on expirationDate itself (the hard deadline).
//
// Reuses lib/ics.ts. Pure function — no fetches, no storage writes.
// Pairs with the existing next-move heuristic that nags about renewals
// in-app: the calendar event makes the nag visible *outside* Tradeline.

import { buildIcs, downloadIcs } from "./ics";
import type { License } from "./compliance-licenses";

const DAY_MS = 86_400_000;
const RENEWAL_LEAD_DAYS = 45;
// Don't emit events for licenses expiring more than this far out — the
// operator's calendar shouldn't fill up with reminders 2 years away.
const MAX_HORIZON_DAYS = 365;

export type LicenseRenewalEventCount = {
  totalLicenses: number;
  totalEvents: number;
  startEvents: number;
  expiryEvents: number;
  skippedAlreadyExpired: number;
  skippedBeyondHorizon: number;
  skippedNoDate: number;
};

type EventInput = Parameters<typeof buildIcs>[0][number];

function safeDate(iso: string): Date | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

export function buildLicenseRenewalEvents(
  licenses: License[],
  now: Date = new Date()
): { events: EventInput[]; counts: LicenseRenewalEventCount } {
  const counts: LicenseRenewalEventCount = {
    totalLicenses: licenses.length,
    totalEvents: 0,
    startEvents: 0,
    expiryEvents: 0,
    skippedAlreadyExpired: 0,
    skippedBeyondHorizon: 0,
    skippedNoDate: 0,
  };
  const events: EventInput[] = [];
  const horizonMs = now.getTime() + MAX_HORIZON_DAYS * DAY_MS;

  for (const l of licenses) {
    const exp = safeDate(l.expirationDate);
    if (!exp) {
      counts.skippedNoDate++;
      continue;
    }
    const expMs = exp.getTime();
    if (expMs < now.getTime()) {
      counts.skippedAlreadyExpired++;
      continue;
    }
    if (expMs > horizonMs) {
      counts.skippedBeyondHorizon++;
      continue;
    }

    const baseUid = `tradeline-license-${l.state}-${l.licenseType.replace(/\s+/g, "-")}-${l.expirationDate}@tradeline.io`;

    const startAt = new Date(expMs - RENEWAL_LEAD_DAYS * DAY_MS);
    // Schedule at 10:00 local so calendars don't show overnight events
    startAt.setHours(10, 0, 0, 0);

    // Only emit the start event if it's in the future — for licenses
    // less than 45 days out, the operator is already in the danger zone
    // and the expiry event alone is the right nudge.
    if (startAt.getTime() > now.getTime()) {
      events.push({
        uid: `${baseUid}-renewal-start`,
        scheduledAt: startAt,
        summary: `Start ${l.state} ${l.licenseType} renewal`,
        description: [
          `Your ${l.state} ${l.licenseType} license expires on ${l.expirationDate}.`,
          "",
          `Most state processing takes 30-60 days. Starting today gives ${RENEWAL_LEAD_DAYS}d of headroom.`,
          "",
          "Open Tradeline → Compliance to see the renewal checklist for this state.",
        ].join("\\n"),
      });
      counts.startEvents++;
    }

    const expiryAt = new Date(expMs);
    expiryAt.setHours(9, 0, 0, 0);
    events.push({
      uid: `${baseUid}-expiry`,
      scheduledAt: expiryAt,
      summary: `License expires today: ${l.state} ${l.licenseType}`,
      description: [
        `Hard deadline — ${l.state} ${l.licenseType} license lapses today.`,
        "",
        `If not renewed, the compliance shield will block outreach and bids on ${l.state} accounts until you re-license.`,
      ].join("\\n"),
    });
    counts.expiryEvents++;
  }
  counts.totalEvents = events.length;
  return { events, counts };
}

export function buildLicenseRenewalIcs(licenses: License[], now: Date = new Date()): {
  ics: string | null;
  counts: LicenseRenewalEventCount;
} {
  const { events, counts } = buildLicenseRenewalEvents(licenses, now);
  if (events.length === 0) return { ics: null, counts };
  const ics = buildIcs(events, "-//Tradeline//License renewal calendar//EN");
  return { ics, counts };
}

export function downloadLicenseRenewalIcs(licenses: License[]): {
  ok: boolean;
  counts: LicenseRenewalEventCount;
} {
  const { ics, counts } = buildLicenseRenewalIcs(licenses);
  if (!ics) return { ok: false, counts };
  const stamp = new Date().toISOString().slice(0, 10);
  downloadIcs(`tradeline-license-renewals-${stamp}.ics`, ics);
  return { ok: true, counts };
}
