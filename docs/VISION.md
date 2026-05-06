# The Tradeline Vision

> **What we are when we&rsquo;re the standard:** the operating system for the
> US non-performing-loan market. Every licensed buyer, every broker, every
> servicer, every regulator, every originator — they all touch Tradeline at
> some point in their workflow.
>
> We get there by stacking moats. Year 1 we&rsquo;re a data product. Year 2
> we&rsquo;re a workflow platform. Year 3 we&rsquo;re the marketplace and the
> benchmark. Year 5 we&rsquo;re infrastructure no one wants to compete with.
>
> *Last updated 2026-05-06.*

---

## 1. The five-year arc

| Year | Shape | Customer | Pricing |
|---|---|---|---|
| **1 — Data** | B2B SaaS surfacing public-source NPL signals (Today, Banks, News, Court). MCP-native so AI agents are first-class. | Licensed debt buyers, collection agencies, debt brokers. | $99–$899/mo + $2k–$5k research reports. Target $5k MRR by month 12. |
| **2 — Workflow** | Add Pipeline, Portfolio, Compliance, Brokers, Servicers. Tradeline becomes the operating console for a licensed buyer&rsquo;s entire week. We launch our own licensed buyer arm to dogfood. | Same buyers, plus their COOs and compliance teams. | $299–$2k/mo seat-priced, with usage-based add-ons (tape uploads, MCP calls, alerts). $50k+ MRR. |
| **3 — Marketplace** | Tradeline-mediated bid platform. Anonymous tape benchmarking pool. Buyer-reputation scoring. Standardized tape schema (the &ldquo;FIX protocol&rdquo; of NPL). Hypothecation lender directory. | Brokers, banks (originators) selling direct, buyers, lenders. | Take rate on transactions + premium SaaS. $500k+ MRR. |
| **4 — Adjacent assets** | Cross-asset expansion: student loans, auto, equipment, judgments, tax liens, junior mortgages, commercial. Each is a separate vertical with the same shape. International (UK, EU, LATAM NPL markets). | Asset-class specialists; cross-strategy funds. | Same model, multiplied by 5 verticals. |
| **5 — Infrastructure** | Embedded in bank divestiture desks (white-label), insurance underwriting (NPL pool risk pricing), regulators (CFPB / state AGs use us for market surveillance), academia. SDK + API revenue. | The whole industry. | API + license revenue dwarfs SaaS. The standard. |

The arc compounds because **each layer feeds the next**: data customers tell us what workflows they want; workflow customers generate the transaction volume that makes the marketplace work; marketplace data feeds the benchmarks that make us infrastructure.

---

## 2. The three moats that compound

### Moat 1 — Aggregated visibility into bank divestiture timing
We see the public signals (SEC + XBRL + news + court) that predict when a bank will divest, faster and cleaner than any single buyer can on their own. As more buyers use us, we learn which signals actually mature into deals (because they tell us). That ground-truth feedback loop is irreproducible without our customers.

### Moat 2 — Anonymized cross-portfolio benchmarks
Once buyers run their own portfolios on Tradeline (Year 2+), we hold the largest anonymized dataset of NPL collection performance in the industry. No individual customer will ever see another&rsquo;s data; everyone benefits from the aggregate. &ldquo;Your collection rate on Q2-2024 mid-Atlantic credit card paper is in the 38th percentile; here&rsquo;s the median.&rdquo; That benchmark is a product nobody else can build because nobody else has the customer set.

### Moat 3 — Standardized tape format + reputation
Today every broker emails CSVs in their own format; every buyer parses them by hand. If Tradeline becomes the default ingestion + normalization layer (Phase 3 work), we become the FIX/SWIFT of NPL — the protocol everyone has to speak to participate in the market. Combined with buyer-reputation scoring (who closes vs. walks away from bids), we control market access in a way that&rsquo;s extremely hard to displace.

---

## 3. Twelve features beyond Phase 1, ranked by leverage

These are the things that make Tradeline indispensable. Not all 12 ship; the top 4–5 should.

| # | Feature | Why it&rsquo;s leverage | Phase |
|---|---|---|---|
| 1 | **Tape evaluation copilot** — paste a CSV (no PII to us, just aggregates), get instant scoring + originator context + comparable deals | The single most painful manual workflow in the industry. Becomes the killer-feature wedge for Pro tier. | 2 |
| 2 | **Earnings-call AI** — every quarterly earnings call across our 31 banks transcribed and signal-extracted within 1 hour | The radar already monitors filings; calls are the other half. Compounds with Moat 1. | 2 |
| 3 | **Broker tape watchlist** — track every broker&rsquo;s posting cadence and cohort; pre-filter the offerings you&rsquo;d actually bid on | This is the workflow layer of Year 2. Forces brokers to either work with us or lose deal flow visibility. | 2 |
| 4 | **Hypothecation eligibility tracker** — once you own paper, see which lenders take it as collateral, at what advance rate | Closes the loop on the founder&rsquo;s original vision (buy → re-perform → leverage). Makes us indispensable to a leveraged buyer. | 2 |
| 5 | **Anonymized collection benchmarks** — compare your portfolio&rsquo;s recovery rate against the cohort median | Moat 2 starts here. Each customer added makes the benchmarks better. | 3 |
| 6 | **Servicer report card** — automated remittance reconciliation; performance vs. peers across your servicer panel | Big buyers use 3–5 servicers; nobody compares them well. We can. | 3 |
| 7 | **Compliance auto-monitor** — license + bond expirations, Reg F changes by state, AG enforcement actions matched to your operating footprint | Recurring anxiety we make go away. Sticky. | 2 |
| 8 | **Mediated bid platform** — Tradeline-hosted tape preview + blind bidding; we take 1–2% of transaction value | Marketplace moat. Phase 3 ambition. Heavy regulatory work. | 3+ |
| 9 | **Buyer reputation scoring** — close rates, post-close behavior, broker references | Nobody&rsquo;s built this and it&rsquo;s the natural complement to the bid platform. | 3+ |
| 10 | **Cross-asset expansion** — auto, student, medical, judgments, junior mortgages | Same shape, different vertical. 5x revenue ceiling. | 3+ |
| 11 | **International NPL** — UK, Italy, Spain, LATAM. Different statutes, same protocol. | Moats are even softer abroad. | 4+ |
| 12 | **Embedded SDK for banks** — let originators run their own divestiture desks on top of Tradeline. White-label. | Year 5 infrastructure play. The standard becomes load-bearing. | 5 |

---

## 4. The AI-native posture (why MCP matters more than dashboards)

Every competitor will sell a dashboard. Tradeline already ships an MCP server (`mcp-servers/deal-radar`) so a licensed buyer&rsquo;s Claude can answer:

> *&ldquo;What regional banks have charge-offs accelerating more than 100% YoY, no recent broker-side news, and trade in states where I&rsquo;m licensed? Pull last 4 quarters of XBRL data for the top 3.&rdquo;*

…in one shot. That&rsquo;s not a dashboard query. That&rsquo;s an analyst-replacement query.

By Year 2 the MCP exposes:
- All the radar data
- Tape evaluation tools
- Broker tape feeds
- Compliance lookups
- Hypothecation calculators

The dashboard stays for visual exploration; the agent does the work.

The shift in customer behavior we&rsquo;re betting on: **by 2027, every serious NPL buyer has an AI agent on their team.** The buyers who give that agent access to Tradeline data run circles around the ones still logging into a portal. Once we win the agent layer, displacing us means rebuilding the agent integration AND the data pipeline AND the customer relationships.

---

## 5. What Tradeline is NOT, even at full vision

These are decisions we make on purpose so we don&rsquo;t become legally radioactive:

- **Not a Consumer Reporting Agency.** We never assemble or score consumer-level credit/payment profiles for use in third-party decisions. That registration + audit burden destroys the operating margin and constrains the product. Forever-no.
- **Not a debt collector or servicer.** Even when our internal arm (Year 2+) holds licenses, the SaaS company stays software. The servicing happens at third-party servicers we *report on*, not *operate*.
- **Not a broker.** We can mediate bids on a marketplace (Phase 3) without broker-dealer registration if we&rsquo;re careful — the platform connects parties, doesn&rsquo;t take principal risk on transactions. That distinction is load-bearing.
- **Not a fund manager.** &ldquo;Tradeline Capital&rdquo; might happen Year 4+ as a separate entity if the data moat warrants it, but the SaaS and the fund are distinct businesses with separate regulators and separate boards.

The architecture in `02_ARCHITECTURE.md` and the red lines in `docs/legal/00_RED_LINES.md` are written so these constraints are enforceable in code, not just in policy.

---

## 6. Becoming the standard — three things that have to go right

### a. Speed of distribution in Year 1
The data product has to land in the hands of 25–100 licensed buyers before competitors notice the wedge. Direct outreach via RMAI / ACA / brokers; conferences; LinkedIn newsletter. Year 1 success is *being known by everyone in the industry by month 12*, even if revenue is modest.

### b. Network effects in Year 2
Every customer added makes the benchmarks better, makes the broker watchlist sharper, makes the servicer report card more useful. Pricing must be tuned so customer #50 is more valuable to customer #1 than customer #51&rsquo;s subscription fee — i.e. cross-customer benefit > marginal LTV. That&rsquo;s the data-flywheel test.

### c. Regulatory thoughtfulness in Year 3
The marketplace and benchmarking features sit close to several regulatory walls (CRA, broker-dealer, market manipulation around tape pricing). Get the lawyers involved early. The product designs that survive regulatory pressure are the ones that win — competitors that try to skip this fail spectacularly under their first CFPB inquiry.

---

## 7. Why we win

| Reason | Detail |
|---|---|
| **Founder is a future customer** | Year 2 licensed-buyer arm dogfoods the product. Every workflow that&rsquo;s painful internally becomes a feature. |
| **Free-tier infrastructure** | Phase 1 budget under $5k means we ship features competitors can&rsquo;t justify until they&rsquo;ve raised. We compound first. |
| **AI-native** | MCP server exists in v0.0.1. Competitors who add AI &ldquo;chat&rdquo; on top of a dashboard in 2027 will look like they&rsquo;re still on Excel. |
| **Compliance-as-architecture** | Red lines in code (`docs/legal/00_RED_LINES.md`) plus an auditable schema (`docs/schema.sql` separates customer tapes with RLS) means we can pass a CFPB inquiry without a panic. Competitors who treat compliance as an afterthought wash out. |
| **Patient capital from operations** | We don&rsquo;t need to raise to win. SaaS revenue + licensed buyer P&amp;L + (eventually) fund management fees. Every dollar of revenue funds the next layer. |

---

## 8. What we want by EOY each year

- **EOY 1:** $5k MRR · 25 customers · 2 paid research reports · LLC + state license filed · this Vision doc reviewed by 5 customers and updated
- **EOY 2:** $50k MRR · 75 customers · licensed-buyer arm has bought 2–3 portfolios · MCP usage at 1k+ tool calls/day across customers
- **EOY 3:** $500k MRR · 200 customers · marketplace beta with 3 pilot brokers · cross-portfolio benchmarks live · first hypothecation transaction
- **EOY 4:** $5M ARR · 5+ asset class verticals live · UK pilot · 1k+ customers · separate-entity Tradeline Capital fund evaluation
- **EOY 5:** Industry standard. Every meaningful US NPL transaction touches Tradeline somewhere. Defensible enough to take to market or stay private.

---

## 9. Reality checks

This document is ambition. Ambition without honest reality checks is investor theater. The honest reality:

- **Phase 1 reality:** none of this matters if 5 buyer-discovery calls don&rsquo;t confirm pain. The roadmap (`03_PHASE_ROADMAP.md`) gates everything on that.
- **Phase 2 reality:** if churn is over 10% monthly, we don&rsquo;t have product-market fit, we have product-market interest. Fix retention before adding features.
- **Phase 3 reality:** the marketplace + benchmarking moves are 5–10x harder than the data product. Don&rsquo;t start them until $50k+ MRR proves the business.
- **Phase 4–5 reality:** these phases happen because Phase 1–3 went well. Don&rsquo;t bring up &ldquo;international expansion&rdquo; in a fundraising deck for a $5k-MRR company. Until you can.

We become the standard one customer at a time. The vision is the why. The roadmap is the how. The next call this week is the what.
