import type { RadarSnapshot, SecSignal, Originator, NewsSignal } from "./snapshot";
import { plainSignal, statusFor } from "./signal-copy";

export type WeeklyDigest = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  stats: {
    strong: number;
    watching: number;
    signals: number;
    news: number;
    banks: number;
  };
};

function isoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function originatorRow(o: Originator, tone: "strong" | "watching"): string {
  const color = tone === "strong" ? "#fb923c" : "#f59e0b";
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-family:'SF Mono',Consolas,monospace;font-size:14px;color:${color};width:80px;">${escape(
        o.ticker
      )}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#e5e5e5;">${escape(
        o.name || o.ticker
      )}</td>
      <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-family:'SF Mono',Consolas,monospace;font-size:12px;color:#a3a3a3;text-align:right;">conf ${o.max_confidence.toFixed(
        2
      )}</td>
    </tr>`;
}

function signalLine(s: SecSignal): string {
  const copy = plainSignal(s.signal_type);
  const yoyChip =
    s.source === "sec_xbrl" && typeof s.yoy_pct === "number"
      ? `<span style="font-family:'SF Mono',Consolas,monospace;font-size:11px;color:${
          s.yoy_pct >= 100 ? "#f87171" : "#fbbf24"
        };margin-left:8px;">${s.yoy_pct >= 0 ? "+" : ""}${s.yoy_pct.toFixed(0)}% YoY</span>`
      : "";
  return `
    <li style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#e5e5e5;margin-bottom:6px;">
      <span style="font-family:'SF Mono',Consolas,monospace;color:#fb923c;">${escape(s.ticker)}</span>
      <span style="color:#d4d4d4;">${escape(copy.label)}</span>
      ${yoyChip}
      <span style="color:#737373;font-size:11px;margin-left:6px;">(${escape(s.form_type)})</span>
    </li>`;
}

function newsLine(n: NewsSignal): string {
  const tickers = (n.matched_tickers || []).join(" · ");
  return `
    <li style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#e5e5e5;margin-bottom:8px;">
      <span style="font-family:'SF Mono',Consolas,monospace;color:#fb923c;font-size:11px;">${escape(tickers)}</span>
      <a href="${escape(n.link)}" style="color:#fb923c;text-decoration:none;">${escape(n.title)}</a>
      ${n.publisher ? `<span style="color:#737373;font-size:11px;margin-left:6px;">${escape(n.publisher)}</span>` : ""}
    </li>`;
}

export function buildWeeklyDigest(
  snap: RadarSnapshot,
  opts: { siteUrl?: string } = {}
): WeeklyDigest {
  const site = (opts.siteUrl || "https://tradeline.io").replace(/\/$/, "");
  const week = isoWeek(new Date());
  const strong = snap.originators.filter((o) => statusFor(o) === "strong").slice(0, 5);
  const watching = snap.originators.filter((o) => statusFor(o) === "watching").slice(0, 5);
  const topSignals = [...snap.top_signals]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  const news = snap.matched_news.slice(0, 3);

  const subject = `Tradeline weekly · ${week} · ${strong.length} banks need attention`;
  const preheader = strong.length
    ? `Strong signals on ${strong
        .slice(0, 3)
        .map((o) => o.ticker)
        .join(", ")}${strong.length > 3 ? "…" : ""}.`
    : "Quiet week — every tracked bank is within normal credit-quality bands.";

  const strongTable = strong.length
    ? `<table style="width:100%;border-collapse:collapse;margin-top:10px;">${strong
        .map((o) => originatorRow(o, "strong"))
        .join("")}</table>`
    : `<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#a3a3a3;margin:6px 0;">No strong signals this week.</p>`;

  const watchingTable = watching.length
    ? `<table style="width:100%;border-collapse:collapse;margin-top:10px;">${watching
        .map((o) => originatorRow(o, "watching"))
        .join("")}</table>`
    : "";

  const signalsList = topSignals.length
    ? `<ul style="padding-left:18px;margin:6px 0 0 0;">${topSignals.map(signalLine).join("")}</ul>`
    : `<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#a3a3a3;">No high-confidence signals fired this week.</p>`;

  const newsList = news.length
    ? `<ul style="padding-left:18px;margin:6px 0 0 0;">${news.map(newsLine).join("")}</ul>`
    : "";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escape(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141414;border:1px solid #2a2a2a;">
          <tr>
            <td style="padding:24px 28px 8px 28px;">
              <div style="font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#737373;">
                Tradeline weekly · ${week}
              </div>
              <h1 style="margin:8px 0 0 0;font-family:Georgia,serif;font-size:32px;line-height:1.1;color:#fafafa;letter-spacing:-0.5px;">
                <span style="color:#fb923c;font-style:italic;">${strong.length}</span> banks need attention.
              </h1>
              <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#a3a3a3;">
                Scanned ${snap.originators.length} US banks, fintechs, and specialty lenders this week.
                ${snap.summary?.sec_signals_total || 0} signals scored from
                ${snap.summary?.filings_total || 0} public filings.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px 0 28px;">
              <div style="font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#fb923c;">
                Strong signals · ${strong.length} names
              </div>
              ${strongTable}
            </td>
          </tr>

          ${
            watching.length
              ? `<tr><td style="padding:20px 28px 0 28px;">
                  <div style="font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b;">
                    Worth watching · ${watching.length} names
                  </div>
                  ${watchingTable}
                </td></tr>`
              : ""
          }

          <tr>
            <td style="padding:20px 28px 0 28px;">
              <div style="font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#737373;">
                Top signals this week
              </div>
              ${signalsList}
            </td>
          </tr>

          ${
            news.length
              ? `<tr><td style="padding:20px 28px 0 28px;">
                  <div style="font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#737373;">
                    In the news
                  </div>
                  ${newsList}
                </td></tr>`
              : ""
          }

          <tr>
            <td style="padding:28px 28px 24px 28px;">
              <a href="${site}/report" style="display:inline-block;padding:10px 18px;background:linear-gradient(135deg,#f5a623 0%,#fb923c 40%,#ec4899 100%);color:#1a0c00;font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;border-radius:6px;">
                See full preview &rarr;
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 28px 28px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-family:'SF Mono',Consolas,monospace;font-size:11px;color:#737373;line-height:1.6;">
                Snapshot generated ${(snap.generated_at || "").slice(0, 16)} UTC.
                Public-source data only. Zero consumer information.
                <br><br>
                <a href="${site}" style="color:#a3a3a3;text-decoration:none;">tradeline.io</a> &middot;
                <a href="${site}/app/today" style="color:#a3a3a3;text-decoration:none;">Open workbase</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text version
  const lines: string[] = [
    `TRADELINE WEEKLY · ${week}`,
    ``,
    `${strong.length} banks need attention this week.`,
    `Scanned ${snap.originators.length} US banks. ${snap.summary?.sec_signals_total || 0} signals from ${snap.summary?.filings_total || 0} filings.`,
    ``,
    `STRONG SIGNALS (${strong.length}):`,
    ...strong.map((o) => `  ${o.ticker.padEnd(8)} ${o.name || o.ticker} · conf ${o.max_confidence.toFixed(2)}`),
  ];
  if (watching.length) {
    lines.push(
      ``,
      `WORTH WATCHING (${watching.length}):`,
      ...watching.map((o) => `  ${o.ticker.padEnd(8)} ${o.name || o.ticker} · conf ${o.max_confidence.toFixed(2)}`)
    );
  }
  if (topSignals.length) {
    lines.push(``, `TOP SIGNALS:`);
    for (const s of topSignals) {
      const yoy =
        s.source === "sec_xbrl" && typeof s.yoy_pct === "number"
          ? ` (${s.yoy_pct >= 0 ? "+" : ""}${s.yoy_pct.toFixed(0)}% YoY)`
          : "";
      lines.push(`  ${s.ticker} · ${plainSignal(s.signal_type).label}${yoy}`);
    }
  }
  if (news.length) {
    lines.push(``, `IN THE NEWS:`);
    for (const n of news) {
      lines.push(`  ${(n.matched_tickers || []).join(" / ")} · ${n.title}`);
      lines.push(`    ${n.link}`);
    }
  }
  lines.push(
    ``,
    `Full preview: ${site}/report`,
    `Workbase: ${site}/app/today`,
    ``,
    `Public-source data only. Zero consumer information.`
  );
  const text = lines.join("\n");

  return {
    subject,
    preheader,
    html,
    text,
    stats: {
      strong: strong.length,
      watching: watching.length,
      signals: topSignals.length,
      news: news.length,
      banks: snap.originators.length,
    },
  };
}

/**
 * Wraps the current weekly digest in a welcome frame. Sent automatically the
 * moment someone subscribes via /report, so they don't have to wait until the
 * next Monday to get value.
 */
export function buildWelcomeEmail(
  snap: RadarSnapshot,
  lead: { email: string; name?: string; type?: string },
  opts: { siteUrl?: string } = {}
): WeeklyDigest {
  const site = (opts.siteUrl || "https://tradeline.io").replace(/\/$/, "");
  const digest = buildWeeklyDigest(snap, { siteUrl: site });

  const firstName = (lead.name || "").trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `Welcome, ${escape(firstName)}` : "Welcome to Tradeline";

  const welcomeSubject = `${greeting} — here's this week's Charge-Off Report`;
  const welcomePreheader =
    "You just subscribed. Here's the latest edition while it's fresh.";

  // Insert a welcome banner into the existing digest HTML right after the
  // <body> tag's wrapper table opens — surgical splice keeps the rest of the
  // styling/structure identical to a normal Monday send.
  const welcomeBanner = `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:linear-gradient(135deg,#f5a623 0%,#fb923c 40%,#ec4899 100%);">
          <tr>
            <td style="padding:20px 28px;">
              <div style="font-family:'SF Mono',Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#1a0c00;">
                Welcome to Tradeline weekly
              </div>
              <h2 style="margin:6px 0 0 0;font-family:Georgia,serif;font-size:22px;line-height:1.2;color:#1a0c00;letter-spacing:-0.3px;">
                You're in. Here's this week's edition while it's fresh.
              </h2>
              <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#3a1f08;">
                Every Monday you'll get the next one — plain English on which banks
                are showing distress, what changed week-over-week, and the asset
                classes most likely to divest. No paywall, no consumer data, no fluff.
              </p>
            </td>
          </tr>
        </table>
        <div style="height:18px;line-height:18px;">&nbsp;</div>`;

  // Splice the welcome banner just before the main digest table.
  const html = digest.html.replace(
    /<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141414/,
    welcomeBanner +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#141414'
  );

  const welcomeText = [
    `${greeting.replace(/&[^;]+;/g, "")} —`,
    ``,
    `You just subscribed to the Tradeline weekly Charge-Off Report. Welcome.`,
    `Every Monday you'll get the next edition. Here's this week's while it's fresh.`,
    ``,
    `---`,
    ``,
    digest.text,
  ].join("\n");

  return {
    subject: welcomeSubject,
    preheader: welcomePreheader,
    html,
    text: welcomeText,
    stats: digest.stats,
  };
}
