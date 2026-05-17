"use client";

// ICS (iCalendar) export — drops follow-up reminders into the user's
// Google Calendar / Outlook / Apple Calendar. Pure client-side; no API.
//
// RFC 5545 spec. Keep it minimal — we want maximum compatibility, not
// every optional field.

type FollowUpEvent = {
  /** Day 7 or 14 from outreach send. */
  scheduledAt: Date;
  /** Short calendar title. */
  summary: string;
  /** Body text — appears in the event details. */
  description: string;
  /** URL the event links to (bank detail page). */
  url?: string;
  /** Stable identifier for this event (so re-imports update instead of duplicate). */
  uid: string;
};

/**
 * RFC 5545 requires CRLF line endings, lines folded at 75 octets, and
 * specific date/time formatting. This helper handles all of that.
 */
export function buildIcs(events: FollowUpEvent[], prodId = "-//Tradeline//Debt-buyer OS//EN"): string {
  const now = formatDateTime(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(ev.uid)}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${formatDateTime(ev.scheduledAt)}`);
    // 30-minute calendar slot — long enough to actually do the follow-up
    const end = new Date(ev.scheduledAt.getTime() + 30 * 60 * 1000);
    lines.push(`DTEND:${formatDateTime(end)}`);
    lines.push(`SUMMARY:${escapeText(ev.summary)}`);
    lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    if (ev.url) lines.push(`URL:${ev.url}`);
    // 10 min popup before the event fires
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeText(ev.summary)}`);
    lines.push("TRIGGER:-PT10M");
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return foldLines(lines).join("\r\n") + "\r\n";
}

/** Compose two follow-up events (day 7 + day 14) for a broker outreach. */
export function buildOutreachFollowUps(args: {
  ticker: string;
  bankName: string;
  brokerShortName: string;
  brokerName: string;
  sentAt: Date;
  siteUrl?: string;
}): FollowUpEvent[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const day7 = new Date(args.sentAt.getTime() + 7 * dayMs);
  const day14 = new Date(args.sentAt.getTime() + 14 * dayMs);
  // Schedule both at 10:00 local time so they don't fire at 3am.
  day7.setHours(10, 0, 0, 0);
  day14.setHours(10, 0, 0, 0);

  const bankUrl = `${args.siteUrl || "https://tradeline.io"}/app/banks/${args.ticker}`;
  const baseUid = `tradeline-${args.ticker}-${args.brokerShortName}-${args.sentAt.toISOString().slice(0, 10)}`;

  return [
    {
      uid: `${baseUid}-day7@tradeline.io`,
      scheduledAt: day7,
      summary: `Follow up with ${args.brokerShortName} about ${args.ticker}`,
      description: [
        `It's been 7 days since you emailed ${args.brokerName} about ${args.bankName} (${args.ticker}).`,
        "",
        `If no reply yet, the follow-up template is pre-filled on the bank page: ${bankUrl}`,
        "",
        `If they replied but you forgot to log it, paste their email into the Broker Reply Classifier on the same page — Tradeline AI will draft your response.`,
      ].join("\\n"),
      url: bankUrl,
    },
    {
      uid: `${baseUid}-day14@tradeline.io`,
      scheduledAt: day14,
      summary: `Stop chasing · ${args.ticker} to ${args.brokerShortName}`,
      description: [
        `14 days since the outreach to ${args.brokerName} about ${args.bankName} (${args.ticker}). Time to move on.`,
        "",
        `Don't send a third email — that burns the relationship for the next opportunity. Mark them cold in Pipeline and try the next broker.`,
        "",
        `Alternate broker picks for this bank: ${bankUrl}`,
      ].join("\\n"),
      url: bankUrl,
    },
  ];
}

/** Trigger a browser download of an ICS string. */
export function downloadIcs(filename: string, ics: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/* ─────── helpers ─────── */

function formatDateTime(d: Date): string {
  // UTC YYYYMMDDTHHMMSSZ per RFC 5545
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Fold long lines per RFC 5545 (75 octets max, continuation starts with a space). */
function foldLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.length <= 75) {
      out.push(line);
      continue;
    }
    let remaining = line;
    let first = true;
    while (remaining.length > 0) {
      const chunkLen = first ? 75 : 74;
      const chunk = remaining.slice(0, chunkLen);
      out.push(first ? chunk : " " + chunk);
      remaining = remaining.slice(chunkLen);
      first = false;
    }
  }
  return out;
}
