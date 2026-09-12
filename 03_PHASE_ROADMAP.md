# 03 — Phase Roadmap

> **Rule:** No phase advances without (a) hitting its definition of done, and (b) passing the Reality Gate (D-V-F). When in doubt, ship smaller.

---

## Phase Overview

| Phase | Name | Duration | Outcome |
|---|---|---|---|
| **0** | Foundation | Weeks 1–2 | Entity formed, stack deployed, 5 buyer interviews booked |
| **1** | Deal Radar MVP | Weeks 3–8 | Free product live, 25 buyers on email list, 5 design partners |
| **2** | Monetization | Weeks 9–16 | First paid customer ($99–$299/mo), 3 paid by Week 16 |
| **3** | Data Product + Scale | Weeks 17–26 | $5k MRR, first $2k research report sold |
| **4** | Licensing Prep | Months 7–12 | War chest built, state license filed, first portfolio bid |
| **5** | Licensed Buyer | Year 2 | First debt portfolio purchased, first re-performing note hypothecated |

---

## Phase 0 — Foundation (Weeks 1–2)

**Goal:** Don't write code yet. De-risk the legal stack and validate problem.

### Week 1
- [ ] **Day 1–2:** Decide on operating state → form LLC (use Northwest Registered Agent or ZenBusiness, ~$100–$300)
- [ ] **Day 2:** Apply for EIN (free, IRS website, 10 min)
- [ ] **Day 3:** Business bank account (Mercury or Relay — both free, online, no minimums)
- [ ] **Day 4–5:** Domain + Google Workspace ($6/mo) + GitHub org (free)
- [ ] **Day 5:** Buy `[brand].com` ($15/yr Cloudflare or Porkbun)

### Week 2 — Customer Discovery (Most Important Week)
- [ ] **Build a list of 30 active US debt buyers/collection agencies** (sources: RMAI member directory, ACA International, LinkedIn search "debt buyer" "debt portfolio")
- [ ] **Send 30 cold emails / LinkedIn DMs** with this template:
  > Hey [name], I'm researching how debt buyers source and evaluate portfolios. Not selling anything — would you trade 20 minutes for early access to a deal-flow tool I'm building for buyers? I'll share what I'm seeing across the market.
- [ ] **Goal:** 5 calls booked. (10–15% response rate is normal; if you get <2, your list or message is wrong — fix before building.)
- [ ] **On each call, ask:**
  1. Where do you currently find portfolios for sale?
  2. What's your biggest pain in evaluating a tape?
  3. What do you pay for any current intelligence tools?
  4. If a tool aggregated [X] for $99–$299/mo, would you pay? At what price?
  5. Would you be a design partner — free for 6 months, in exchange for feedback?

**Phase 0 Reality Gate:**
- 🟢 If 3+ calls confirm the pain and willingness to pay → proceed to Phase 1
- 🟡 If signals are mixed → run 5 more calls before building
- 🔴 If buyers say "we already have this from [vendor]" → pivot the wedge before coding

---

## Phase 1 — Deal Radar MVP (Weeks 3–8)

**Goal:** Ship a free product that aggregates publicly available deal flow + bank divestiture signals. Build email list and design-partner relationships. **Don't charge yet.**

### Definition of Done
- Email digest going out 3x/week with new deals + bank signals
- 5 design partners actively using it
- 25 total emails on the list
- One MCP server (`deal-radar-mcp`) callable from Claude Desktop

### Week 3 — Stack Setup
- [ ] Supabase project, schema for `deals`, `originators`, `filings`
- [ ] Vercel project + Next.js skeleton
- [ ] Domain pointed, basic landing page deployed
- [ ] GitHub repo with monorepo (`/apps/web`, `/services/scoring`, `/workers`, `/mcp-servers`)

### Week 4 — Ingestion
- [ ] `worker_sec_edgar.py` — pull 10-Q/10-K filings of top 50 US banks, extract charge-off mentions
- [ ] Cron deployed (Cloudflare Workers cron or Hetzner cron)
- [ ] Manual smoke test: 50 filings ingested

### Week 5 — Apify + News
- [ ] Apify free tier set up
- [ ] One actor configured: Google search for "debt portfolio sale" / "non-performing notes for sale"
- [ ] News RSS aggregator (free, RSS only)
- [ ] Dedup pipeline: same deal mentioned twice = one record

### Week 6 — Web App
- [ ] Auth (Supabase Auth, email magic-link, free)
- [ ] Dashboard showing 7-day rolling deal feed
- [ ] Filter UI (asset class, face-value range, region)
- [ ] Email digest endpoint (Resend free tier)

### Week 7 — MCP Server
- [ ] `deal-radar-mcp` (Python or TypeScript SDK)
- [ ] Three tools: `search_deals`, `get_deal_detail`, `subscribe_alert`
- [ ] Deploy to free tier (Cloudflare Workers or Fly.io)
- [ ] Document install instructions for Claude Desktop users

### Week 8 — Onboard Design Partners
- [ ] 5 design partners onboarded
- [ ] Weekly 30-min check-in calls scheduled with each
- [ ] Public landing page with email capture live
- [ ] First "what we found this week" email sent

**Phase 1 Reality Gate:**
- 🟢 5 active design partners + 25 list signups → Phase 2
- 🟡 2–4 active partners → extend Phase 1 by 2 weeks, refine value
- 🔴 0–1 active partners → product-market fit failure; revisit ICP

---

## Phase 2 — Monetization (Weeks 9–16)

**Goal:** Convert design partners and list to paying. First $1 collected by Week 12.

### Definition of Done
- 3+ paying customers at $99–$299/mo
- ~$1k MRR
- Stripe revenue dashboard active
- Portfolio scoring tool live (the "Pulse" feature)

### Week 9–10 — Build Portfolio Pulse
- [ ] CSV upload + secure storage (Supabase Storage, encrypted)
- [ ] Scoring service v1 (Python/FastAPI, scikit-learn baseline)
- [ ] Public-feature-only inputs (originator score, vintage, asset class, region)
- [ ] PDF report generation (basic; use ReportLab or weasyprint)
- [ ] `portfolio-pulse-mcp` server

### Week 11 — Pricing & Billing
- [ ] Stripe integration (test mode → live)
- [ ] Three tiers:
  - **Solo** $99/mo — Deal Radar + 2 portfolio scores/mo
  - **Pro** $299/mo — Unlimited Deal Radar + 10 scores/mo + MCP access
  - **Team** $899/mo — Above + 5 seats + research credit
- [ ] Customer agreement template (attorney review here — $300–$500)

### Week 12 — Convert
- [ ] Email each design partner with "free period ending; founder pricing locked at 50% off for life"
- [ ] Goal: 2 conversions
- [ ] Public launch on Indie Hackers, Hacker News, RMAI forums

### Week 13–14 — Compliance Tracker
- [ ] State-by-state license database (manually researched + linked sources)
- [ ] `compliance-tracker-mcp` server
- [ ] Alert when state regs change (RSS from state AG sites)

### Week 15–16 — Iterate Toward $1k MRR
- [ ] Weekly office hours with paying customers
- [ ] Ship 1 customer-requested feature/week
- [ ] Goal: 5 paying customers by end of Week 16

**Phase 2 Reality Gate:**
- 🟢 $1k+ MRR, churn <10% → Phase 3
- 🟡 $300–$999 MRR → optimize sales motion 4 more weeks
- 🔴 <$300 MRR → re-interview to find what's missing or wrong about the wedge

---

## Phase 3 — Data Product + Scale (Weeks 17–26)

**Goal:** Add a second revenue stream. Sell market intelligence reports to banks/originators. Get to $5k MRR.

### Definition of Done
- $5k MRR
- 1+ paid research report ($2k–$5k)
- 15+ SaaS customers
- Operations runnable in 15 hrs/week (you have time for sales)

### Build
- [ ] **Quarterly Bank Divestiture Report** — sell to banks, debt brokers, investors
- [ ] **Originator Intelligence subscriptions** — premium tier ($2k/mo) for institutional buyers
- [ ] Affiliate program (10% recurring) — debt brokers refer buyers

### Marketing
- [ ] Speak / sponsor at one RMAI or Receivables event
- [ ] Weekly LinkedIn newsletter w/ market commentary
- [ ] Podcast appearances (target: ARM Industry Insights, Insidearm)

**Phase 3 Reality Gate:**
- 🟢 $5k MRR + 1 report sold → Phase 4
- 🔴 If stuck below $3k MRR for 90 days → focus on retention/expansion before adding products

---

## Phase 4 — Licensing Prep (Months 7–12)

**Goal:** Use SaaS profits + relationships to set up the licensed buying arm. **Do not skip ahead.** Most who blow up here are people who tried to buy debt without proper structure.

### Activities
- [ ] Build $25k–$50k war chest from SaaS profits (separate account)
- [ ] Choose first state to license in (low cost + your operating state)
- [ ] Hire fractional consumer finance attorney (~$2–5k retainer)
- [ ] File for license + bond
- [ ] Open custodial account at a bank that does note servicing
- [ ] Identify ONE asset class to start with — **recommend secured (junior mortgages or auto)** because:
  - Better hypothecation LTV (real collateral)
  - Lower regulatory burden than unsecured CC debt
  - Easier to value
- [ ] Build relationships with 3 sellers (you'll have these from SaaS by now)

### Phase 4 Reality Gate
- 🟢 License in hand + $25k+ ready → Phase 5
- 🔴 If license takes >9 months → keep scaling SaaS instead

---

## Phase 5 — Licensed Buyer (Year 2)

**Small first deals only. Walk before running.**

- First portfolio: $5k–$15k purchase price, secured paper, well-known seller
- Service through licensed third-party servicer (don't try to operate collections yourself)
- Track collection rate vs. expectations for 6+ months
- Hypothecate **after 12 months of seasoned performance**, not 6
- Use proceeds to fund next deal — never personal capital again

### Targets Year 2
- 3 portfolios purchased
- 1 portfolio hypothecated successfully
- SaaS at $15k MRR (it keeps growing)

---

## Kill / Pivot Criteria

| Signal | Action |
|---|---|
| Phase 0: <2 buyer calls land | Pivot ICP or wedge |
| Phase 1: <2 design partners after 6 weeks | Pivot product |
| Phase 2: <$300 MRR after 6 weeks | Pivot pricing or feature set |
| Phase 3: Churn >15% monthly | Stop adding features; fix retention |
| Phase 4: License denied | Wholesale SaaS exit consideration |
| Phase 5: First portfolio collects <50% of underwriting expectation | Pause buying; tighten model |

## Cadence Reminder
Update `00_PROJECT_SNAPSHOT.md` weekly. Run a Reality Gate review at every phase boundary. Don't advance because you "feel" ready — advance because the gate says you are.
