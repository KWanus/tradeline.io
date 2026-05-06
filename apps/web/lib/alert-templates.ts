import type { SecSignal } from "./snapshot";
import { plainSignal } from "./signal-copy";
import { SIGNAL_TYPE_LABEL, type Subscriber } from "./subscribers";

export type AlertContent = {
  subject: string;
  html: string;
  text: string;
};

// Plain-text alternative for email clients that strip HTML, and Slack/webhook
// payloads that prefer text.
function buildPlainText(s: SecSignal, subscriber: Subscriber): string {
  const copy = plainSignal(s.signal_type);
  const lines: string[] = [];
  lines.push(`Tradeline alert — ${s.ticker}`);
  lines.push("");
  lines.push(`${copy.label}.`);
  if (s.source === "sec_xbrl" && typeof s.yoy_pct === "number") {
    const sign = s.yoy_pct >= 0 ? "+" : "";
    lines.push(`Year-over-year change: ${sign}${s.yoy_pct.toFixed(1)}%`);
  }
  if (s.period_label) lines.push(`Period: ${s.period_label}`);
  lines.push(`Confidence: ${s.confidence.toFixed(2)}`);
  lines.push(`Form: ${s.form_type}`);
  if (s.items && s.items.length) lines.push(`Items: ${s.items.join(", ")}`);
  lines.push("");
  lines.push(`What it means: ${copy.meaning}`);
  lines.push(`What you'd do next: ${copy.action}`);
  lines.push("");
  lines.push(`Source: ${s.url}`);
  lines.push("");
  lines.push("---");
  lines.push(
    `You're receiving this because you subscribed to alerts on ${subscriber.preferences.tickers.length === 0 ? "all originators" : subscriber.preferences.tickers.join(", ")} at confidence ≥ ${subscriber.preferences.minConfidence.toFixed(2)}.`
  );
  return lines.join("\n");
}

function buildHtml(s: SecSignal, subscriber: Subscriber): string {
  const copy = plainSignal(s.signal_type);
  const yoyLine =
    s.source === "sec_xbrl" && typeof s.yoy_pct === "number"
      ? `<tr><td style="padding:6px 0;color:#888;width:140px;">Year-over-year</td><td style="padding:6px 0;color:${s.yoy_pct >= 100 ? "#dc2626" : "#d97706"};font-weight:600">${s.yoy_pct >= 0 ? "+" : ""}${s.yoy_pct.toFixed(1)}%</td></tr>`
      : "";
  const periodLine = s.period_label
    ? `<tr><td style="padding:6px 0;color:#888;">Period</td><td style="padding:6px 0;">${s.period_label}</td></tr>`
    : "";
  const itemsLine =
    s.items && s.items.length
      ? `<tr><td style="padding:6px 0;color:#888;">8-K items</td><td style="padding:6px 0;font-family:monospace;font-size:13px;">${s.items.join(", ")}</td></tr>`
      : "";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tradeline alert</title>
</head>
<body style="margin:0;padding:0;background:#fafaf7;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e3da;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #f0eee5;">
              <div style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;margin-right:8px;"></div>
              <span style="font-family:Georgia,serif;font-style:italic;font-size:18px;color:#1a1a1a;">Tradeline</span>
              <span style="float:right;font-size:11px;color:#888;letter-spacing:0.05em;text-transform:uppercase;">${SIGNAL_TYPE_LABEL[s.signal_type] || s.signal_type}</span>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:28px 28px 8px;">
              <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:8px;">${s.tier || "—"}</div>
              <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:32px;line-height:1.15;color:#1a1a1a;font-weight:400;">
                <span style="font-family:'SF Mono',monospace;font-size:30px;color:#10b981;font-weight:500;">${s.ticker}</span>
                <span style="font-style:italic;">${s.originator_name || ""}</span>
              </h1>
              <p style="margin:14px 0 0;font-size:18px;color:#1a1a1a;font-family:Georgia,serif;">
                ${copy.label}.
              </p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding:18px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                <tr><td style="padding:6px 0;color:#888;width:140px;">Confidence</td><td style="padding:6px 0;color:#10b981;font-weight:600">${s.confidence.toFixed(2)}</td></tr>
                ${yoyLine}
                ${periodLine}
                <tr><td style="padding:6px 0;color:#888;">Form</td><td style="padding:6px 0;">${s.form_type}</td></tr>
                ${itemsLine}
              </table>
            </td>
          </tr>

          <!-- Why / What -->
          <tr>
            <td style="padding:8px 28px 24px;">
              <div style="background:#f8f7f2;border-radius:6px;padding:18px 20px;">
                <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:6px;">What it means</div>
                <div style="font-size:15px;color:#333;margin-bottom:14px;">${copy.meaning}</div>
                <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:6px;">What you&rsquo;d do next</div>
                <div style="font-size:15px;color:#333;">${copy.action}</div>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 28px 28px;">
              <a href="${s.url}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">Open SEC filing →</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #f0eee5;background:#fafaf7;">
              <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
                You&rsquo;re receiving this because <strong style="color:#555;">${subscriber.orgName}</strong> subscribed to alerts on ${subscriber.preferences.tickers.length === 0 ? "all tracked originators" : subscriber.preferences.tickers.join(", ")} at confidence ≥ ${subscriber.preferences.minConfidence.toFixed(2)}.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#888;line-height:1.5;">
                Public-source data only · No consumer information · Verify before acting.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAlert(s: SecSignal, subscriber: Subscriber): AlertContent {
  const copy = plainSignal(s.signal_type);
  const yoyPart =
    s.source === "sec_xbrl" && typeof s.yoy_pct === "number"
      ? ` (${s.yoy_pct >= 0 ? "+" : ""}${s.yoy_pct.toFixed(1)}% YoY)`
      : "";
  const subject = `${s.ticker} · ${copy.label}${yoyPart} · conf ${s.confidence.toFixed(2)}`;
  return {
    subject,
    html: buildHtml(s, subscriber),
    text: buildPlainText(s, subscriber),
  };
}
