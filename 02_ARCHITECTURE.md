# 02 — Architecture

> **Design principle:** Boring, free-tier, modular. Every component must be replaceable without rewriting the others. Optimize for "still running in 12 months on $200/mo" not "scales to a million users on day 1."

---

## High-Level System (Text Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC DATA SOURCES                          │
│  SEC EDGAR · PACER/Court Records · State AG sites · Bank IR     │
│  RMAI public listings · Public auction sites · News feeds       │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────┐         ┌─────────────────┐
│  APIFY       │         │  PLAYWRIGHT     │
│  (managed    │         │  (self-hosted   │
│  scrapers)   │         │   workers)      │
└──────┬───────┘         └────────┬────────┘
       │                          │
       └────────────┬─────────────┘
                    ▼
        ┌───────────────────────┐
        │   INGESTION QUEUE     │  ← Cloudflare Queues / Redis
        │   (dedup, normalize)  │
        └──────────┬────────────┘
                   ▼
        ┌───────────────────────┐
        │   POSTGRES (Supabase) │
        │   ├─ deals            │
        │   ├─ originators      │
        │   ├─ filings          │
        │   ├─ scoring_models   │
        │   └─ customer_tapes   │  ← uploaded by buyers
        └──────────┬────────────┘
                   ▼
        ┌───────────────────────┐
        │   SCORING SERVICE     │  ← Python/FastAPI
        │   (portfolio + deal   │     scikit-learn baseline
        │    scoring models)    │     no consumer-level scoring
        └──────────┬────────────┘
                   ▼
        ┌───────────────────────────────────────────┐
        │   API LAYER (FastAPI)                     │
        ├───────────────────────────────────────────┤
        │   ├─ REST endpoints (web app)             │
        │   ├─ MCP SERVERS (AI-native access)       │
        │   │   ├─ deal-radar-mcp                   │
        │   │   ├─ portfolio-pulse-mcp              │
        │   │   └─ compliance-tracker-mcp           │
        │   └─ Webhook outputs (email digests)      │
        └──────────┬────────────────────────────────┘
                   ▼
        ┌───────────────────────┐
        │  WEB APP (Next.js)    │  ← deployed on Vercel free tier
        │  + Email digest       │  ← Resend free tier
        │  + Stripe billing     │
        └───────────────────────┘
```

---

## Component Breakdown

### 1. Apify Layer — Managed Scraping for "Annoying" Sources
**Use Apify for sources where:**
- Site has anti-bot protection (Cloudflare, captchas)
- A community actor already exists (LinkedIn, Google Maps, news aggregators)
- You don't want to maintain the scraper yourself

**Apify actors to deploy:**
- `apify/google-search-scraper` — track keywords like "consumer debt portfolio sale," "non-performing notes for sale"
- `apify/contact-info-scraper` — find buyer-side contacts (companies, NOT consumers)
- Custom actor: bank press release monitor

**Cost discipline:** Apify free tier = $5 platform credit/mo. Plan = $49/mo. Stay on free until paid customers exist.

### 2. Playwright Layer — Self-Hosted Workers for Volume
**Use Playwright for:**
- High-volume public sources (court records, SEC EDGAR via API instead actually, public auction listings)
- Anything you want full control over
- Sources with stable HTML (low maintenance burden)

**Deployment:** Cheap VPS ($6/mo Hetzner or free Oracle Cloud Always Free tier), Docker, cron-driven workers.

**Workers to build (Phase 1):**
- `worker_sec_edgar.py` — pull 10-Q/10-K filings, extract loan-loss & charge-off mentions (use SEC's free API, not scraping)
- `worker_pacer_bk.py` — public bankruptcy court data (PACER has fees; start with free alternatives like CourtListener/RECAP)
- `worker_state_auctions.py` — state-level public auction listings of judgments/notes
- `worker_news.py` — bank divestiture news via RSS + Google News

### 3. MCP Server Layer — Your AI-Native Differentiator
This is the moat you mentioned and it's the right instinct. **MCP (Model Context Protocol) lets AI agents (Claude, ChatGPT, internal tools) query your data with natural language.** Your competitors will have dashboards; you'll have a conversational interface.

**Three MCP servers to build:**

#### `deal-radar-mcp`
Exposes the deal database. Tools:
- `search_deals(face_value_range, asset_class, originator_type, region)`
- `get_deal_detail(deal_id)`
- `subscribe_alert(criteria)`

#### `portfolio-pulse-mcp`
Exposes scoring service. Tools:
- `score_portfolio(tape_id)` → returns risk scores at the *portfolio* level, not consumer level
- `compare_to_market(tape_id)` → benchmarks against aggregate market data
- `originator_history(originator_id)` → public charge-off / divestiture pattern

#### `compliance-tracker-mcp`
State-by-state regulatory database. Tools:
- `check_state_requirements(state, activity)` → "do I need a license to buy in TX?"
- `latest_reg_changes(since_date)`
- `bond_calculator(state, portfolio_size)`

**Why MCP matters for sales:** "Connect this to your Claude subscription and ask it to find deals" beats "log into another dashboard" for sophisticated buyers. Plus it's a clean B2B API surface.

**Implementation:** Use Anthropic's MCP TypeScript or Python SDK. Each server is ~200-500 lines of glue code over your REST API.

### 4. Scoring Service — The IP
**Phase 1 (free):** scikit-learn baseline using public features only:
- Originator's public charge-off rate (SEC filings)
- Asset class (CC, auto, medical, mortgage)
- Vintage / age of debt
- Geographic concentration (state-level economic indicators from BLS, free)
- Portfolio size (face value buckets)

**No consumer-level features.** Period.

**Phase 2:** customers upload tapes; we add their (legally obtained) tape-level features to improve model. Tape stays customer-owned and customer-private.

### 5. Data Layer
- **Supabase** (Postgres + auth + storage) — free tier handles up to 500MB DB, 1GB storage, 50k MAU. Plenty for Phase 1.
- **Schema sketched in `docs/schema.sql` later in Phase 1.**

### 6. App Layer
- **Next.js** on Vercel free tier
- **Stripe** for billing (no monthly fee)
- **Resend** for email digests (free 3k/mo)
- **PostHog** free tier for analytics

---

## Data Flow Examples

**Example 1: Deal alert pipeline**
1. Cron triggers `worker_news.py` every 6 hours
2. Worker pulls bank press releases → finds "completed sale of $X portfolio"
3. Normalizes into `deals` table
4. Scoring service computes deal attractiveness score
5. Email digest service queries deals where users' criteria match → sends alert
6. User clicks link → web app shows full deal record

**Example 2: Buyer scores a portfolio**
1. Buyer uploads CSV tape via web app
2. File goes to Supabase Storage (encrypted at rest)
3. Scoring service pulls tape, joins to public originator data
4. Returns portfolio-level score + breakdown (no consumer-level output)
5. Buyer downloads PDF report or queries via MCP from their Claude

---

## What We're NOT Building (and Why)

| Feature | Why Not |
|---|---|
| Consumer-level "who will pay" predictor | FCRA — we'd be a CRA |
| Skip tracing | regulated; do not enter without CRA registration |
| Auto-dialer / collection bot | FDCPA/Reg F — only for licensed collectors |
| Consumer-facing app | wrong ICP; lower-value, more regulation |
| Real-time integrations to bank core systems | Phase 3+; needs SOC2 |

---

## Acceptance Checks (End of Phase 1)
- [ ] One Apify actor running, populating `deals` table daily
- [ ] One Playwright worker running on free-tier VPS, ingesting SEC filings
- [ ] `deal-radar-mcp` server live, callable from Claude Desktop
- [ ] Web app login + dashboard renders 7 days of fresh deals
- [ ] Stripe checkout works (in test mode)
- [ ] Daily email digest sends to founder + 5 pilot users

## What's Next After Architecture
→ See `03_PHASE_ROADMAP.md` for week-by-week build order.
