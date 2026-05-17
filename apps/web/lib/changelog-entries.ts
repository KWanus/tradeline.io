export type ChangelogEntry = {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** Short paragraph rendered above the bullets. */
  summary?: string;
  /** Concrete things that shipped. */
  bullets: string[];
  /** Optional tags for filtering / badges. */
  tags?: string[];
};

/**
 * Public changelog. Add new entries at the TOP. Keep entries scoped to user-
 * visible value, not refactors.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-17",
    title: "Public surfaces — /about, /coverage, /privacy, /terms, sitemap",
    summary:
      "The site went from polished prototype to discoverable product. Search engines can now find it and visitors can read the legal + provenance docs before subscribing.",
    bullets: [
      "/coverage — public, searchable, ranked list of every tracked bank. Filter by status, search by ticker or name.",
      "/about — how the radar works, what data we touch vs never touch, who built it.",
      "/privacy + /terms — plain-English notices.",
      "Shared PublicFooter component used across /, /report, /about, /coverage, /privacy, /terms.",
      "/sitemap.xml + /robots.txt — all 6 public surfaces indexable; /app/* and tokenized /unsubscribe URLs blocked.",
    ],
    tags: ["public", "seo", "legal"],
  },
  {
    date: "2026-05-17",
    title: "One-click unsubscribe — RFC 8058 + signed HMAC links",
    summary:
      "Every weekly + welcome email now ships with a personalized signed unsubscribe link in both the HTML footer and the standard headers. Gmail's one-click button works natively.",
    bullets: [
      "HMAC-SHA256(email, secret) tokens, base64url, 32 chars. Same email → same token forever so archived links keep working.",
      "/unsubscribe public page handles 4 states server-side: no params (instructions), invalid token, already unsubscribed, valid + needs confirmation.",
      "/api/unsubscribe accepts JSON / form-urlencoded (Gmail one-click) / query string.",
      "List-Unsubscribe-Post: List-Unsubscribe=One-Click header for in-inbox unsubscribe.",
      "readReportLeads() transparently filters anyone in report_unsubscribes.jsonl — no code changes elsewhere.",
    ],
    tags: ["email", "compliance"],
  },
  {
    date: "2026-05-17",
    title: "Auto-send the weekly Charge-Off Report every Monday",
    summary:
      "The supply-side loop is now hands-off after the initial wire-up. Once CRON_SECRET is set, the user ships nothing the rest of the week.",
    bullets: [
      "/api/cron/send-weekly — protected GET + POST, Bearer-token auth, batch-sends via Resend (100/call) with per-recipient unsub URLs.",
      ".github/workflows/send-weekly-report.yml — runs every Monday 13:00 UTC (09:00 ET). workflow_dispatch with dry-run for manual auth checks.",
      "/app/report-leads shows an Armed / Not armed status panel with the next fire timestamp.",
      "Founder gets a summary email after each fire with delivered/failed counts.",
    ],
    tags: ["cron", "email"],
  },
  {
    date: "2026-05-17",
    title: "Auto-welcome on /report subscribe",
    summary:
      "New subscribers get the current week's digest within seconds instead of waiting until Monday. Wrapped in a gradient welcome banner.",
    bullets: [
      "buildWelcomeEmail(snap, lead, opts) wraps the digest HTML with a welcome frame + tailored subject.",
      "/api/report/subscribe now sends both the welcome to the new subscriber and the founder notification.",
      "Subscribe form copy switches to 'Check your inbox · this week's edition is on its way' when send succeeds.",
    ],
    tags: ["email", "onboarding"],
  },
  {
    date: "2026-05-17",
    title: "/app/report-leads — operations cockpit for the weekly digest",
    summary:
      "Until now there was no in-app way to actually send the Charge-Off Report to subscribers. /report captured emails to a JSONL but the loop ended there. This is the missing piece.",
    bullets: [
      "Reads data/output/report_leads.jsonl, shows subscriber count + breakdown by type.",
      "Gradient Send Panel — test send to yourself first, then arm-and-confirm to send to all.",
      "Live HTML preview via sandboxed iframe.",
      "Stat grid: subscribers, unsubscribed, strong banks, watching, signals, news.",
    ],
    tags: ["email", "ops"],
  },
  {
    date: "2026-05-17",
    title: "/app/progress — weekly self-review dashboard",
    summary:
      "Tradeline is an action machine but had no view of 'is it working?' Now one page aggregates every persisted activity signal: emails sent, pipeline state, journey + fund readiness + license progress, foundation pass/fail.",
    bullets: [
      "Headline verdict computed from data — 'Nothing happening this week' / 'Volume but no traction' / 'X won deals · keep compounding.'",
      "Top-line metric tiles: emails last 7d (warn-toned below 5/wk), open deals + face, won deals + face, conversion %.",
      "Pipeline 7-stage box grid with win-rate calc.",
      "Operator progress trio — journey ladder, fund-readiness gates, state licenses.",
      "Foundation row — three pass/fail tiles for buyer profile, watchlist, brokers contacted.",
    ],
    tags: ["workbase", "measurement"],
  },
  {
    date: "2026-05-17",
    title: "Tape copilot — four curated sample tapes",
    summary:
      "New visitors land on /app/tools/tape, see Choose CSV file, and bounce because they don't have a real tape yet. Now there are 4 one-click demo profiles.",
    bullets: [
      "Fresh credit card ($2.1M face), Aged credit card ($1.4M, 2-3yr), Junior mortgage ($4.8M seasoned), Subprime auto ($890k recent).",
      "Auto-detects asset class and selects matching ASSET_DEFAULTS preset.",
      "Smooth-scrolls to results, warn-toned 'Demo data' banner with Clear shortcut.",
      "Save-to-pipeline still works on demo data so you can see the round-trip.",
    ],
    tags: ["workbase", "activation"],
  },
  {
    date: "2026-05-17",
    title: "Action-first audit complete — every page has a decision action",
    summary:
      "10-commit sweep through every remaining directory + reference page to make sure no surface was info-without-action.",
    bullets: [
      "/app/banks/discovered — per-card Start outreach / Watch / Dismiss.",
      "/app/setup/license — per-state action panel: data sheet, bond email, attorney email, 4-state status tracker.",
      "/app/setup/fund — fund-readiness scorecard with 8 LP gates.",
      "/app/setup/providers — per-provider Request quote ⚡ with 7 category-specific templates.",
      "/app/learn — 6-step interactive journey ladder with deep-links per step.",
      "/app/news — per-headline Act on this ⚡ deep-link to the bank page.",
      "/app/brokers + /app/lenders + /app/servicers — per-row Send intro ⚡.",
      "/app/portfolio — Compose lender pitch ⚡ on hypothecation-ready holdings.",
      "/app/marketplace — free-report form + paid tier ladder conversion path.",
    ],
    tags: ["workbase", "action-first"],
  },
];
