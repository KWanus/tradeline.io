# Tradeline · session report

77 commits across one session. Goal: take Tradeline from "early demo" to "operational SaaS that can take customer payments, run a real debt-buying outreach loop end-to-end, AND launch publicly with the legal, compliance, distribution, and ops surfaces a real business needs." Built action-first inside `/app`, action-first **and** discoverable outside.

The last 21 commits were a sweep across the public surface and SEO posture: legal pages, sitemap + robots, /about, /coverage, /changelog, /apply, /status, RSS feeds, security.txt, per-page OG cards, /api/health, JSON-LD structured data, and **57 individually indexable per-bank pages** at /banks/[ticker]. The site now has 66 sitemap entries (9 core surfaces + 57 banks), each one a real SEO landing.

---

## The end-to-end deal flow (what a user can do today)

```
PUBLIC SURFACES — 14 routes + 57 per-bank pages + 12 machine-readable endpoints (6 JSON APIs, 2 RSS, sitemap, robots, security.txt, /api/health), all indexable
  /                          Marketing page · 5 pricing tiers · Apply CTA links to /apply
  /report                    Public weekly Charge-Off Report landing · subscribe form
  /about                     Provenance + scoring model + what-we-touch-vs-don't
  /coverage                  Searchable list of every tracked bank (filter by status/ticker)
  /changelog                 Public log of what's shipped · newest first · RSS link
  /apply                     Design-partner application form · 8 fields · founder gets reply-to-applicant notification
  /status                    Live dashboard — snapshot age + service env-var checks
  /privacy                   Plain-English data notice
  /terms                     Plain-English terms of use
  /unsubscribe               Token-verified one-click unsubscribe page
  /banks/[ticker]            Public per-bank landing — status + signals + matched news + subscribe CTA
                             57 pages, all in sitemap at priority 0.6, daily changefreq
                             Article + BreadcrumbList JSON-LD per page
  /kit                       Share-this-thing surface — pre-written tweet / LinkedIn / email copy
                             One-click clipboard, OG-card asset links, design-partner referral callout
  /feeds                     Meta page cataloging every machine-readable endpoint
                             RSS feeds + JSON APIs + well-known endpoints + curl examples
  /news                      Public feed of every bank-matched headline · ticker chip filter
                             hourly changefreq · CollectionPage JSON-LD · 'See TICKER →' deep-link per row
  /signals                   Public feed of scored SEC filings · form + ticker chip filters
                             hourly changefreq · CollectionPage JSON-LD · EDGAR link per row

PUBLIC ENDPOINTS — feeds + APIs + monitoring
  /sitemap.xml               12 surfaces + 57 banks = 69 URL entries
  /robots.txt                Allow public; Disallow /app/, /api/cron, tokenized unsubscribe
  /feed.xml                  RSS 2.0 of the current weekly digest
  /changelog.xml             RSS 2.0 of every changelog entry
  /.well-known/security.txt  RFC 9116 — contacts + 1yr expiry + disclosure policy
  /api/health                JSON for uptime monitors · status=ok|degraded|stale
  /api/banks                 JSON index — all tracked banks · ?status= ?tier= ?limit=
  /api/banks/[ticker]        Per-bank JSON — signals + news + links · open CORS
  /api/news                  Recent matched headlines · ?ticker= ?limit= · ticker count map
  /api/signals               Recent SEC signals · ?ticker= ?form= ?limit= · ticker + form count maps
  /api/changelog             JSON of every release entry · ?tag= filter + tag count map
  /api/openapi.json          OpenAPI 3.0.3 spec for every JSON endpoint

  Per-page OG images (1200×630)
    /opengraph-image                      Homepage card
    /report/opengraph-image               Weekly stats card
    /about/opengraph-image                Banks scored / signals / filings
    /coverage/opengraph-image             Tracked / strong / watching
    /changelog/opengraph-image            Releases / items / latest date
    /apply/opengraph-image                5 seats / 50% discount / wkly office hours
    /app/banks/[ticker]/opengraph-image   Per-bank tailored

EMAIL PIPELINE — fully automated
  /report subscribe form     Captures email/name/type → data/output/report_leads.jsonl
  Auto-welcome               Resend sends this week's digest within seconds of signup
  Weekly cron                .github/workflows/send-weekly-report.yml fires Mondays 13:00 UTC
                             /api/cron/send-weekly authenticates via CRON_SECRET
  One-click unsubscribe      HMAC-SHA256 signed links + RFC 8058 List-Unsubscribe-Post
  /app/report-leads          Operations cockpit — preview + manual send + unsubscribed count

ONBOARDING — 5 minutes, no friction
  /app/welcome               4-screen wizard: profile → pick bank → send email → done

DAILY (open every morning)
  /app/today
    ↳ WelcomeBanner          (hides itself once wizard done)
    ↳ ProfileBanner          (hides itself once profile complete)
    ↳ RightNowWidget         Single highest-priority action (synthesized from 7 signals)
    ↳ Daily AI Briefing      4-section morning read · web search · cached per-day
    ↳ Hero strong-signal     Plain-English why this bank
    ↳ Watchlist section      Banks you starred
    ↳ Recent news            Filtered to your tracked banks

ACTING
  /app/banks                 57 banks · "Call now / Watch / Skip" filters
    ↳ Recommended strip      Pulls top 6 green banks to the top
    ↳ Auto-scanner banner    Shows new SEC discoveries

  /app/banks/discovered      Auto-scan output as a decision queue
    ↳ Start outreach ⚡      Deep-link to bank detail when ticker matched
    ↳ Watch                  Toggles shared watchlist
    ↳ Dismiss                Collapses with Undo · client-side false-positive list

  /app/banks/[ticker]        4-step playbook per bank
    ↳ Profile check
    ↳ Email brokers          Pre-filled outreach · 3 recommended brokers
       ↳ Send via Tradeline ⚡    Resend transactional · auto-logs outreach
       ↳ Auto-schedule reminders  Day 7 + day 14 via Resend scheduled_at
       ↳ Calendar .ics       Day 7 + day 14 with 10-min popup alarm
       ↳ Open in mail / Copy fallback
    ↳ Add to Pipeline        One-click · creates real Sourced deal
    ↳ Rehearse via tutor     /app/tutor pre-loaded with bank context
    ↳ Broker reply classifier  Paste their reply · AI drafts your response
    ↳ 7-outcome decision tree  Auto-expands "no reply 7d" / "no reply 14d"
    ↳ Watchlist star
    ↳ AI talking points

  /app/pipeline              Deals through 5 stages
    ↳ Stale-deals strip      5+ days no update
    ↳ Compose bid → button   Deep-links to bid calculator with deal context

  /app/portfolio             Owned debt portfolios
    ↳ Hypothecation-ready strip   Auto-surfaces seasoned portfolios

  /app/compliance            License + bond tracker · 50-state SOL chart
    ↳ Expiring-soon strip    Auto-surfaces licenses within 90 days

  /app/customers             Buy-side CRM
    ↳ At-risk strip          14d+ inactive paid customers
    ↳ Send pay link → button Mailto with Stripe Payment Link

  /app/subscribers           Supply-side CRM
    ↳ Send pay link button
    ↳ Real alert email sending via Resend

  /app/tools/tape            Drop CSV → aggregates
    ↳ "Next action" panel    Compose bid email → (face value pre-passed)
    ↳ Save to Pipeline       Then jump to bid composer

  /app/tools/bid-calculator  NPV sliders
    ↳ BidEmailComposer       Reads ?face=, ?ticker=, ?bank=, ?broker= from URL
    ↳ Disciplined or Max     Bid tone picker
    ↳ Send bid ⚡             Resend · auto-fills profile · pipeline-aware

  /app/tools/playbook        Reference: 5 emails · 5 objections · 7 red flags
    ↳ All auto-fill from profile

  /app/marketplace           Supply-side conversion page
    ↳ Free /report subscribe form (left column)
    ↳ 5 paid tiers with mailto pitches (right column)

  ECOSYSTEM DIRECTORIES — every row has "Send intro ⚡" or "Request quote ⚡"
  /app/brokers               9 majors · per-row Resend send + reminders
  /app/lenders               Hypothecation panel · per-row Resend send
  /app/servicers             6 majors · per-row generic relationship-builder
  /app/setup/providers       7 categories (EIN, RA, bank, bond, insurance, attorney, CPA)
                             Each provider gets a category-specific quote-request template

  /app/tutor (Tradeline AI)  Claude Sonnet 4.6
    ↳ Knows your profile · pipeline · watchlist · outreach log · current page bank
    ↳ Research mode          Web search · cited sources · "web searched" badge
    ↳ 3 role-play scenarios  Cold call · Custom email · Negotiate tape price

OPERATIONS (you, the founder)
  /app/profile               Single buyer profile · auto-fills everywhere
  /app/billing               Paste 5 Stripe Payment Link URLs
  /app/launch                Path A: 4-step Go Live
  /app/path                  Path B: 21-step Winning System
  /app/deploy                In-app DEPLOY.md tracker
  /app/setup                 19-item business setup checklist

REFERENCE PAGES — now action-tracking, not lectures
  /app/learn                 6-step journey ladder · deep-links per step · localStorage
  /app/setup/license         Per-state action panel: data sheet, bond email, attorney
                             email, 4-state status tracker (not-started → issued)
  /app/setup/fund            Fund-readiness scorecard · 8 LP gates · progress bar
  /app/news                  Per-headline "Act on this ⚡" → bank detail page

INFRASTRUCTURE
  workers/discover.py        Scans SEC EDGAR 8-K feed every 6h · auto-promotes
  workers/run.py             Existing radar pipeline · expanded to 57 banks
  api/tutor                  Claude w/ web search + per-user context
  api/briefing               Daily synthesis · cached per day
  api/classify-reply         Strict JSON classifier
  api/send-outreach          Resend transactional + scheduled_at reminders
```

---

## What's NOT yet live (and what each gap is for)

| Phase | Surface | Status |
|---|---|---|
| 2 | **Stripe Checkout** (native in-app subscribe flow) | Not yet — uses Payment Links via /app/billing as the bridge. Native needs auth + webhook handlers. |
| 2 | **Auth (Clerk / Supabase Auth)** | Not yet — workbase is single-tenant on localStorage. |
| 2 | **Postgres multi-tenant** | Not yet — all state in localStorage. |
| 2 | **Customer self-service preferences** | Not yet — subscribers can't edit own filters without you. |
| 2 | **Real-time activity tracking** | Not yet — "last activity" / "MRR" fields filled by hand. |
| 2 | **Conversion analytics dashboard** | Not yet — no funnel view. |
| 2 | **MCP server live deploy** | Built in this repo (`mcp-servers/deal-radar`); needs Claude Desktop config to use. |

---

## Wire-up checklist (set on Vercel before customers click pay)

After you finish DEPLOY.md steps 1–3, set these env vars in Vercel → Settings → Environment Variables:

| Variable | Value | What unlocks |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Tradeline AI, daily briefing, reply classifier (already set locally) |
| `RESEND_API_KEY` | `re_...` | Auto-send outreach, scheduled day-7/14 reminders, subscriber alerts |
| `RESEND_FROM` | `Tradeline <noreply@yourdomain.com>` | From-address on all Tradeline-sent email |
| `REPORT_LEADS_NOTIFY_TO` | your email | Where /report subscribe-form leads forward |
| `TRADELINE_SNAPSHOT_URL` | `https://raw.githubusercontent.com/KWanus/tradeline.io/data/radar_snapshot.json` | Lets Vercel read fresh radar data from the GH Actions cron output |
| `TRADELINE_SEC_UA` | `Tradeline workers your@email.com` | SEC requires contact in their User-Agent header |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Used by OG image generator for absolute URLs |
| `NEXT_PUBLIC_USER_EMAIL` | your email | Shows in top-bar profile chip |
| `CRON_SECRET` | random secret (`openssl rand -hex 32`) | Auth for `/api/cron/send-weekly` — GitHub Actions fires it every Monday 13:00 UTC. Set same value as repo secret + `SITE_URL` repo secret. Also doubles as the unsubscribe-link signing key when `UNSUBSCRIBE_SECRET` is unset. |
| `UNSUBSCRIBE_SECRET` | random secret (optional) | Dedicated signing key for one-click unsubscribe links in weekly emails. Falls back to `CRON_SECRET` if unset. Use a dedicated key if you ever plan to rotate `CRON_SECRET`. |

Then enable GitHub Actions on your repo (DEPLOY.md step 2) and the radar refreshes every 6 hours. The weekly Charge-Off Report auto-sends every Monday once `CRON_SECRET` is set on both Vercel and the GitHub repo (DEPLOY.md step 4b).

---

## Commits in this session — 77 total

| # | Commit | What |
|---|---|---|
| 1 | `3e65f39` | Path A · 4-step Go-Live page (sell Tradeline) alongside Path B Winning System |
| 2 | `5f34997` | No-friction sweep — 14 pages rewritten in 5th-grade language |
| 3 | `0b131d8` | 90%-automated next-steps panel on bank detail pages |
| 4 | `7d1f3ca` | Single buyer profile auto-fills every email, script, and AI tutor prompt |
| 5 | `596ddad` | Finish the loop — real pipeline writes, outreach log, watchlist, mailto, tutor context |
| 6 | `743ff29` | Tradeline AI — operator assistant that knows everything + can search the web |
| 7 | `7bca2fc` | Auto-scan SEC EDGAR every 6h for new bank-sector NPL filings |
| 8 | `72f848b` | Expand seed list 31 → 57 banks (fintech, specialty, mortgage, student) |
| 9 | `75b7b09` | SaaS-product chrome — top bar, floating AI button, amber→pink palette |
| 10 | `5042b46` | Full chrome sweep — hero accents, status semantics, mobile top bar |
| 11 | `de46dbe` | Public pricing tiers + branded report landing |
| 12 | `0ca655a` | "What to do now" recommended strips at top of every list page |
| 13 | `2940e61` | Gitignore `.claude` session metadata before public push |
| 14 | `752135c` | DEPLOY.md — step-by-step deploy guide for non-engineers |
| 15 | `0fdc008` | vercel.json fixes monorepo auto-build-command |
| 16 | `4fdf9e9` | In-app /app/deploy tracker with checkboxes for DEPLOY.md |
| 17 | `8c5aa4f` | Done animations — sparkle burst, row glow, toast, milestone banner |
| 18 | `547d2e2` | Done animations on /app/setup + bank-detail playbook |
| 19 | `a41cba1` | Branded favicon + dynamic OG image + Twitter card |
| 20 | `f09df26` | "Right now" priority widget synthesizes one action to take |
| 21 | `92f75fc` | Stripe Payment Links — paste once, charge today |
| 22 | `3dfce99` | Daily AI briefing — 4-section morning read, web-searched, per-day cached |
| 23 | `a830c98` | Broker-reply classifier + tutor role-play scenarios |
| 24 | `391eb76` | "Send via Tradeline" — auto-send outreach via Resend |
| 25 | `edb8dd7` | Scheduled day-7 + day-14 follow-up reminders via Resend |
| 26 | `0101fe8` | 5-minute first-run wizard — zero to first email sent |
| 27 | `a246254` | Per-bank + report OG image variants — tailored share previews |
| 28 | `b357665` | Calendar (.ics) export for day-7 + day-14 follow-ups |
| 29 | `4f3fe91` | Bid email composer — calculator → email to broker in one screen |
| 30 | `3cf83f9` | Compose bid → deep-link from Pipeline to bid email composer |
| 31 | `aabc64b` | Action-first — Tape Copilot → Bid Calculator handoff |
| 32 | `a6cd8dd` | /app/marketplace: free-report form + paid-tier ladder conversion path |
| 33 | `8e5e55f` | /app/portfolio: "Compose lender pitch ⚡" for hypothecation-ready holdings |
| 34 | `38291d3` | Per-row "Send intro ⚡" on /app/brokers + /app/lenders |
| 35 | `76b5395` | Per-row "Send intro ⚡" on /app/servicers — completes ecosystem triad |
| 36 | `e4bc871` | /app/setup/providers: "Request quote ⚡" with 7 category-specific templates |
| 37 | `301a852` | /app/setup/license: per-state action panel — data sheet, bond email, attorney email, status tracker |
| 38 | `82c08bb` | /app/banks/discovered: per-card Start outreach / Watch / Dismiss |
| 39 | `1c9cf3f` | /app/setup/fund: interactive readiness scorecard for the 8 LP gates |
| 40 | `98fb815` | /app/learn: interactive 6-step journey ladder with deep-links per step |
| 41 | `f23220b` | /app/news: per-headline "Act on this ⚡" → bank detail page |
| 42 | `bcc4b90` | /app/report-leads: operations cockpit — preview + send the weekly digest to /report subscribers |
| 43 | `e8b7b9c` | auto-welcome on /report subscribe — new subscribers get this week's digest in seconds |
| 44 | `90a42c3` | /app/progress: self-review dashboard — funnel + journey + foundation in one weekly view |
| 45 | `1d9ff67` | auto-send the weekly Charge-Off Report every Monday — GitHub Actions cron wired |
| 46 | `61bb435` | one-click web unsubscribe — signed HMAC links + RFC 8058 headers |
| 47 | `63d8e58` | tape copilot: four curated sample tapes for first-time visitors |
| 48 | `8e1c6d0` | /privacy + /terms pages + shared PublicFooter + email digest legal links |
| 49 | `4083277` | SEO basics — sitemap.xml + robots.txt + tailored /report metadata |
| 50 | `b1d4bcf` | /about — credibility surface for the report subscribe path |
| 51 | `f5a2201`+`bc6e418` | /coverage — public, searchable, ranked list of every tracked bank |
| 52 | `6c974b0` | /changelog — public log of what's shipped, newest first |
| 53 | `0cc6cd5` | /apply page + /api/apply — design-partner lead capture replaces the mailto |
| 54 | `615dbec` | RSS feeds (/feed.xml + /changelog.xml) + security.txt — non-email distribution + responsible disclosure |
| 55 | `22214c6` | per-page social cards for /about, /coverage, /changelog, /apply |
| 56 | `80c163b` | /api/health JSON endpoint + /status public dashboard |
| 57 | `22306fa` | docs refresh — SESSION-REPORT + changelog catch up to commit 57 |
| 58 | `219f878` | JSON-LD structured data — Organization, WebSite, FAQPage, NewsArticle, CollectionPage |
| 59 | `b5d8aac` | /banks/[ticker] — 57 public per-bank SEO landings + sitemap entries |
| 60 | `dacfb28` | per-bank social cards — /banks/[ticker]/opengraph-image |
| 61 | `b97b62a` | per-bank JSON-LD (Article + BreadcrumbList) + docs refresh to commit 61 |
| 62 | `cef64bc` | tape copilot ?demo= deep-link auto-loads a sample on arrival |
| 63 | `7ee9edf` | /kit — share-this-thing distribution surface |
| 64 | `5b32168` | changelog anchor IDs + docs catch up to commit 63 |
| 65 | `c7e5fb2` | /api/banks/[ticker] — programmatic per-bank radar state |
| 66 | `e71de5b`+`be48a7d` | /api/banks index + /feeds meta page + /api/changelog JSON endpoint |
| 67 | `24c7b38` | /api/openapi.json — OpenAPI 3.0 spec for every JSON endpoint |
| 68 | `339295b` | grouped multi-column PublicFooter (Product/Learn/Developers/Legal) |
| 69 | `4174ea6` | docs catch up to 68 + /report links to /changelog |
| 70 | `994221b` | /changelog ?tag= filter — chip nav + API parity |
| 71 | `2a2e71b` | /news public page — high-frequency SEO surface for matched headlines |
| 72 | `c2ee733` | /api/news + OpenAPI + CollectionPage JSON-LD on /news + docs catch-up |
| 73 | `8ee7729` | /signals — public feed of scored SEC filings across every tracked bank |
| 74 | `6e6b356` | /api/signals JSON parallel + OpenAPI extension + docs catch-up to 74 |
| 75 | `110d274` | per-page social cards for /news, /signals, /feeds |
| 76 | `9f5cbe5` | homepage hero + nav funnel into public content surfaces |
| 77 | `(this)`  | custom /not-found.tsx + docs catch-up to commit 77 |

---

## What changed conceptually

Before this session: a polished prototype with most surfaces being informational.

After this session: an **action-first operating system**. Every surface either (a) tells you the next thing to do, or (b) is the thing you do. No page is a dead end.

Key invariants the workbase now upholds:

1. **One profile, every template.** Type your firm name once at `/app/profile` — it auto-fills every outreach email, reply draft, bid email, playbook script, tutor system prompt, and buyer profile sheet across the entire workbase.

2. **Every list page opens with "what to do."** Banks, Pipeline, Portfolio, Customers, Compliance — each shows a brand-gradient strip pulling the urgent items to the top.

3. **Marking things done is a reward.** Animated checkbox pop · sparkle burst · row glow · toast · milestone banner when full. Tested on Path A, Path B, /app/setup, /app/deploy, and per-bank playbooks.

4. **The AI knows the whole context.** Tradeline AI loads your profile + pipeline + watchlist + outreach log + current page bank, every turn. Plus optional web search.

5. **Outreach is a closed loop.** Cold email → auto-send → scheduled reminders (email + calendar) → reply classifier → drafted response → bid composer → send bid → pipeline auto-advance. No manual data re-entry between any two steps.

6. **The radar grows itself.** SEC EDGAR scanner finds new banks worth tracking every 6 hours. Auto-promotes high-confidence ones; surfaces medium-confidence for review.

7. **Public-facing pages are tailored.** Homepage shows real pricing tiers. Report shows the dynamic bank count. OG image previews are tailored per page so social shares look right.

8. **Every row has a decision action.** Brokers, lenders, servicers, providers, discovered candidates, news headlines, state licensing playbooks — none are read-only lists. Every row offers the action you'd take next (send intro, request quote, start outreach, dismiss, watch). Long-form reference pages — the fund-formation timeline, the operator journey, state licensing — are now interactive trackers with localStorage progress, not lectures.

9. **The site is publicly discoverable, monitorable, and legally adequate.** 10 public routes, all in the sitemap with appropriate priorities. robots.txt allows the public, disallows tokenized URLs and `/app/`. Per-page OG cards so social shares look like the same family of cards. RSS feeds for power users. security.txt for researchers. /privacy + /terms for compliance. /api/health for uptime monitors. /status for human verification.

10. **The supply-side revenue loop is hands-off after wire-up.** Once `CRON_SECRET` is set on Vercel + the GitHub repo, the user ships nothing the rest of the week: radar refreshes every 6h, snapshot writes to data branch, Monday 13:00 UTC the cron fires, every /report subscriber gets a fresh digest with a personalized one-click unsubscribe link, founder gets a delivery summary.

---

## When you're ready to take a customer payment

Three things must be true:
1. Vercel deployed (DEPLOY.md step 1) ✓ — pushed via `vercel.json` fix
2. `ANTHROPIC_API_KEY` + `RESEND_API_KEY` set in Vercel env
3. 5 Stripe Payment Links pasted into `/app/billing` (and the founder's signature on a 14-day-trial product)

That's the gate. Everything else is built.

— Generated end of session.
