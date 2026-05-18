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
    title: "Tradeline is API-first — /api/banks, /api/banks/[ticker], /api/changelog, /feeds",
    summary:
      "Every public surface now has a machine-readable form. Agents, MCP servers, analyst scripts, and downstream apps can pull radar data without scraping HTML.",
    bullets: [
      "/api/banks/[ticker] — per-bank state (top 12 signals with YoY/excerpt/EDGAR link + top 10 news + links). 5-min cache, open CORS, OPTIONS preflight. 404 for unknown tickers, 503 if snapshot fails.",
      "/api/banks — index of all tracked banks sorted strong → watching → quiet → confidence desc. Filters: ?status=, ?tier=, ?limit=N.",
      "/api/changelog — same entries as /changelog (HTML) and /changelog.xml (RSS), shaped for integrators. Stable anchors so consumers can deep-link back.",
      "/feeds — meta page cataloging every machine-readable endpoint with content-type chips and curl + jq examples. MCP server callout points to the playbook for Claude Desktop wire-up.",
      "Bank detail HTML footer gains a 'JSON ↗' link so developers reading a /banks/[ticker] page can click through to the structured form.",
    ],
    tags: ["public", "api", "integrations"],
  },
  {
    date: "2026-05-17",
    title: "/kit — share-this-thing distribution surface",
    summary:
      "Word-of-mouth is how solo founders build. /kit gives design partners + early subscribers pre-written copy they can paste with one click.",
    bullets: [
      "Four KitItem cards with one-click clipboard copy: tweet (≤280 chars), LinkedIn post, forward-to-a-colleague email (subject as a chip + body), conference / signature blurb.",
      "Each card: copy-to-clipboard with confirmation, click-to-select fallback, character/length hints in the description.",
      "Image assets section — direct links to /report, /coverage, /about, /apply OG cards as raw PNGs.",
      "Direct-link grid — 6 ShareLink tiles pointing at the canonical surfaces a recipient would want to land on (including the tape-copilot demo deep-link).",
      "Design-partner referral callout — 3 months extra free workbase for referring a fellow operator.",
      "Copy templated against the live bank count so '57 US banks' stays accurate as the radar grows.",
    ],
    tags: ["public", "distribution"],
  },
  {
    date: "2026-05-17",
    title: "Tape copilot ?demo= deep-link",
    summary:
      "The killer feature is now one-link demoable. External pages (homepage CTA, /about, future tweets, email digests) can send a visitor straight into auto-loaded sample mode without instructions.",
    bullets: [
      "/app/tools/tape?demo=<sample-id> auto-loads on mount and smooth-scrolls to results. Sample ids: card-fresh, card-aged, mortgage-junior, auto-recent.",
      "Invalid or missing param → normal empty state. autoLoadedRef guards against double-fire in StrictMode.",
      "/app/tools/tape/page.tsx wraps TapeUploader in Suspense (Next 16 requires it for useSearchParams in production).",
      "/about gains a 'Try the tape copilot with sample data →' inline link.",
    ],
    tags: ["workbase", "activation"],
  },
  {
    date: "2026-05-17",
    title: "/banks/[ticker] — 57 public per-bank SEO landings + Article schema",
    summary:
      "The radar tracks 57 banks; their names + tickers weren't individually searchable on Tradeline until now. Each becomes an SEO landing for inbound queries like 'Capital One charge-offs.'",
    bullets: [
      "/banks/[ticker] public route — server-rendered from snapshot, generateStaticParams pre-discovers all 57, per-bank generateMetadata.",
      "Page sections: status badge + plain-English meaning, 4-tile stats, tier + last-filed chips, filtered signals list (up to 8 with YoY chips + EDGAR links + excerpts), matched news (up to 5), Subscribe + About CTA.",
      "/coverage list rows now link to /banks/[ticker] — the coverage page becomes the discovery funnel into per-bank pages.",
      "sitemap.xml reads the snapshot at build time and adds an entry per originator (priority 0.6, daily changefreq). 66 total URLs now.",
      "Per-bank OG cards via the shared ogFrame helper — ticker (gradient) + bank name (italic muted) + status/conf/signals/news stats. LinkedIn / X shares of a specific bank look like a per-name card, not the generic site card.",
      "JSON-LD on each bank page — Article schema for rich result eligibility + BreadcrumbList for Home → Coverage → Bank navigation in SERP.",
    ],
    tags: ["public", "seo"],
  },
  {
    date: "2026-05-17",
    title: "JSON-LD structured data — Organization, FAQPage, NewsArticle, CollectionPage",
    summary:
      "Invisible-to-humans SEO polish. Site-wide Organization + WebSite in the root layout, plus per-page schemas on /report (NewsArticle), /about (FAQPage), /changelog (CollectionPage).",
    bullets: [
      "Organization with logo + sameAs (GitHub) makes the brand eligible for Google's knowledge panel and puts the logo next to results.",
      "FAQPage on /about renders 5 distilled Q&As as expandable cards in SERP.",
      "NewsArticle on /report templated with live bank/signal/filing counts and datePublished from the snapshot's generated_at.",
      "Shared lib/json-ld.ts builds + serializes each payload. All inputs are trusted internal sources — no XSS surface.",
    ],
    tags: ["seo"],
  },
  {
    date: "2026-05-17",
    title: "/api/health + /status — observable infrastructure",
    summary:
      "External observers (potential customers, monitors, security researchers) can now verify the radar is fresh and the email pipeline is wired without messaging the operator.",
    bullets: [
      "/api/health JSON for UptimeRobot / BetterUptime / Healthchecks. Always 200; body.status = ok | degraded | stale so monitors alert on the body, not the HTTP code.",
      "/status human dashboard. Tone-coded overall verdict, 4-tile snapshot panel, 4-row services panel with Armed / Not set chips per env var.",
      "VERCEL_GIT_COMMIT_SHA + VERCEL_ENV in the /api/health payload so monitor alerts correlate with specific deploys.",
    ],
    tags: ["public", "ops", "monitoring"],
  },
  {
    date: "2026-05-17",
    title: "Per-page social cards for /about, /coverage, /changelog, /apply",
    summary:
      "Every public page now ships its own 1200x630 OG image instead of falling back to the generic layout default. LinkedIn / X shares of /about look different from shares of /coverage.",
    bullets: [
      "Shared _components/og-frame.tsx — ogFrame({eyebrow, eyebrowMeta?, titleLines, stats?, slug}) helper. Italic display title with tone:'gradient' painting, up to 4 stat tiles, brand T tile + canonical slug.",
      "/about — live snapshot stats. Title: 'Find the deal / before it's a deal.'",
      "/coverage — tracked / strong / watching counts. Title: 'The N US banks / Tradeline tracks.'",
      "/changelog — release + item counts + latest date. Title: 'What's / shipped.'",
      "/apply — 5 seats / 50% discount / wkly office hours. Title: 'Apply for / design partner.'",
    ],
    tags: ["public", "seo"],
  },
  {
    date: "2026-05-17",
    title: "RSS feeds + security.txt — non-email distribution + responsible disclosure",
    summary:
      "Power users who don't want email can subscribe via RSS readers. Security researchers know where to report responsibly.",
    bullets: [
      "/feed.xml — RSS 2.0 of the weekly Charge-Off Report. Week-anchored GUIDs. Full email-safe HTML in content:encoded. Graceful fallback when snapshot fails.",
      "/changelog.xml — RSS 2.0 of every changelog entry. Stable GUIDs. Tags as <category>.",
      "/.well-known/security.txt — RFC 9116. Two contacts, 1-year expiry, disclosure policy inline (30-day fix window, no bug bounty yet, every report read).",
      "Layout metadata.alternates exposes both feeds in every page <head> so browsers auto-discover.",
      "Subscribe-via-RSS links on /report and /changelog.",
    ],
    tags: ["public", "distribution", "security"],
  },
  {
    date: "2026-05-17",
    title: "/apply — design-partner lead capture replaces the mailto",
    summary:
      "The homepage 'Apply for design partner' CTA was a mailto link with no structured capture. Now a proper 8-field form with notification routing.",
    bullets: [
      "8 fields: name, work email, firm, primary state, role (7 options), monthly NPL volume (6 buckets), free-text 'what do you want from Tradeline', optional referral.",
      "/api/apply persists to data/output/applications.jsonl and notifies the founder via Resend with reply_to: <applicant>, so hitting Reply goes back to the lead.",
      "Three ValueCards above the form (half off forever / weekly office hours / roadmap input) and a 4-step 'what happens next' timeline below.",
      "Success state confirms receipt + nudges to subscribe to /report if not ready for the workbase.",
    ],
    tags: ["public", "leads", "monetization"],
  },
  {
    date: "2026-05-17",
    title: "/changelog — public log of what's shipped",
    summary:
      "Tradeline ships continuously but had no public surface that showed it. /changelog is the credibility receipt.",
    bullets: [
      "lib/changelog-entries.ts as the single source of truth. Typed ChangelogEntry array, newest first.",
      "/changelog page renders one card per entry with date stamp, italic serif title, optional tags, summary, bullets.",
      "Link to the full git log on GitHub for anyone wanting to audit beyond the curated entries.",
    ],
    tags: ["public", "credibility"],
  },
  {
    date: "2026-05-17",
    title: "/coverage — public ranked list of every tracked bank",
    summary:
      "57 banks tracked by the radar but no public surface exposed the names to search engines. A buyer searching 'Capital One charge-offs' or 'First Horizon NPL' had no Tradeline page to land on. Fixed.",
    bullets: [
      "Server component sorts strong → watching → quiet by descending max_confidence and hands a materialized view-model to a client list.",
      "Live filter: text search across ticker / name / tier; status pills (All / Strong / Watching / Quiet) with live counts; Reset shortcut.",
      "Responsive table — 6 columns desktop, collapses to ticker + name + confidence + last-filed on mobile.",
      "Auto-discovered banks (from the SEC scanner) get an Auto chip; confidence badge tone matches status.",
    ],
    tags: ["public", "seo"],
  },
  {
    date: "2026-05-17",
    title: "/about — credibility surface for the subscribe path",
    summary:
      "A serious buyer who lands on /report and considers handing over their email reasonably asks 'who are these people, how is this built, what data do they touch?' /about is the answer.",
    bullets: [
      "Hero with live snapshot stats (banks scored, signals indexed, SEC filings ingested).",
      "How the radar works — 4 scoring inputs explained, thresholds called out, link to /app/intel/track-record for the falsifiable log.",
      "What we touch vs never touch — two-card layout calling out the FCRA-scope architecture as deliberate.",
      "Who built this (solo founder, Mid-Atlantic, codebase public on GitHub), pricing across all three paths, disclaimer.",
    ],
    tags: ["public", "credibility"],
  },
  {
    date: "2026-05-17",
    title: "SEO basics — sitemap.xml + robots.txt + tailored /report metadata",
    summary:
      "Site went from polished prototype to discoverable product. Search engines can now index it.",
    bullets: [
      "/sitemap.xml — lists every public surface with lastModified, changeFrequency, priority.",
      "/robots.txt — Allow all 10 public surfaces; Disallow /app/, /api/, and tokenized /unsubscribe URLs.",
      "/report metadata — tailored title + description + openGraph + twitter cards for clean social shares.",
    ],
    tags: ["public", "seo"],
  },
  {
    date: "2026-05-17",
    title: "/privacy + /terms + shared PublicFooter",
    summary:
      "Real compliance gap: the site collected emails via /report and sent transactional email without a discoverable privacy notice or terms of use.",
    bullets: [
      "/privacy — plain-English what we collect, what we don't, how to delete, named subprocessors (Resend).",
      "/terms — not legal/financial advice, no accuracy warranty, user responsibilities around state licensing + FDCPA / Reg F / GLBA, liability cap, Maryland governing law.",
      "_components/public-footer.tsx — single PublicFooter used by /, /report, /about, /coverage, /privacy, /terms.",
      "Email digest footer adds Privacy + Terms links next to Open workbase and Unsubscribe.",
    ],
    tags: ["public", "legal"],
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
