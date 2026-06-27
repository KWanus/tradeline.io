# 04 — Data Sources

> Every source listed here is categorized by legal status. **If a source isn't listed, don't use it until you've classified it.**

---

## Wired as of 2026-06-27 (what the workers actually pull)

| Source | Worker | Role | Status |
|---|---|---|---|
| SEC EDGAR submissions + XBRL companyfacts | `sec_edgar.py`, `xbrl.py`, `discover.py` | Originator signals, 8-K dispositions, auto-discovery | ✅ live |
| FDIC `api.fdic.gov` financials + institutions | `fdic.py` | Community-bank charge-off/NPL flags **+ city/county** | ✅ live |
| NCUA 5300 Call Report bulk data | `ncua.py` | Credit-union charge-off/NPL flags + city | ✅ live |
| CourtListener v4 API | `courtlistener.py` | Bankruptcy/civil court signals | ✅ live |
| Google News RSS | `news_rss.py` | Divestiture chatter → matched to originators | ✅ live |
| Completed-sale news + operator marketplace CSV | `dispositions.py` | **Ground-truth debt-sale events** for the backtest | ✅ live |
| **FRED** (keyless `fredgraph.csv`) | `macro.py` | National consumer-credit stress + per-state unemployment | ✅ live |

**FFIEC:** intentionally **not** wired — the FDIC `financials` API already returns
the Call Report charge-off-by-asset-class fields we need, so a separate FFIEC CDR
pull would be redundant. Revisit only if we need line items FDIC doesn't expose.

**BLS:** accessed **via FRED** (`{ST}UR` series) rather than the BLS API, since
FRED redistributes BLS's LAUS state-unemployment data without BLS's API-key gating.

The **backtest** (`backtest.py`) joins the leading signals (SEC/XBRL + FDIC/NCUA)
to the disposition events (8-K + `dispositions`) to measure the radar's hit rate.

---

## Tier 1: Free + Fully Public (Use These First)

These are public records or publicly distributed information. No FCRA / GLBA exposure.

### SEC EDGAR — `data.sec.gov`
- **What:** All public company filings (10-K, 10-Q, 8-K)
- **Why:** Banks disclose loan-loss provisions, charge-off rates, divestiture plans
- **Access:** Free official API. No scraping needed.
- **Use:** Originator scoring, divestiture early signals
- **Rate limit:** 10 req/sec (very generous)

### Court Records (Bankruptcy + Civil)
- **CourtListener / RECAP** — `courtlistener.com` (Free Law Project)
  - Aggregates federal court records including bankruptcy
  - Free API, very generous rate limits
- **PACER** — direct federal court access
  - Pay per page; use only for targeted lookups
  - $0.10/page, $3 cap per document
- **State court portals** — varies by state; many free; some require Apify/Playwright
- **Use:** Bankruptcy filings, civil judgments, originator litigation

### Bureau of Labor Statistics — `bls.gov`
- **What:** Unemployment, wages, regional economic data
- **Why:** Geographic risk features for portfolio scoring
- **Access:** Free public API

### FFIEC + FDIC Data
- **What:** Bank financial data, including charge-offs by asset class
- **Access:** Free public APIs (`ffiec.gov`, `fdic.gov`)
- **Use:** Originator scoring; bank health signals

### Federal Reserve — FRED
- `fred.stlouisfed.org` — economic data API, free
- Use: macro features for scoring (delinquency rates, consumer credit data, all aggregate)

### State Attorney General sites
- Public actions against debt buyers/collectors → reputation signal for sellers/buyers

### News + Press Releases
- Bank investor relations pages (RSS where available)
- Google News RSS for keywords
- PR Newswire / Business Wire for divestiture announcements

---

## Tier 2: Public-but-Annoying (Apify or Playwright)

Public information, but require scraping. Check robots.txt and ToS for each.

### Public Auction Sites
- Treasury.gov auction listings
- State surplus property sites (judgments sometimes auctioned)
- County tax sale sites (for tax liens — different asset class but adjacent)

### Industry Trade Publications
- **InsideARM** — receivables industry news
- **AccountsRecovery.net** — news + jobs (signal: who's hiring = who's growing)
- **Debt Connection** — listings of portfolios for sale (some public, some member-only)

### LinkedIn (CAREFUL)
- LinkedIn's ToS prohibits scraping. **Do not scrape.**
- ✅ OK: manual research using their UI, exporting your own connections
- ✅ OK: Apify's "LinkedIn People Search Actor" if you accept the ToS gray area (consult attorney first)
- ❌ Not OK: bulk scraping for a database product

---

## Tier 3: Paid / Licensed (Phase 2+ When Revenue Justifies)

These are legitimate paid feeds — buy them when MRR makes the cost reasonable.

### Industry Data
- **RMAI member directory** — included with membership ($1,500–$5,000/yr)
- **ACA International data** — membership-based
- **Insolve / DebtConnect** — portfolio listing platforms; some public, some require account

### Compliance Data
- **Clarius / industry compliance feeds** — state regulatory tracking ($1k–$5k/yr)

### Originator/Bank Intelligence
- **S&P Capital IQ / Bloomberg** — too expensive for Phase 1, may be worth it Phase 3 for bank-targeted reports
- **Curinos / Argus** — payments/receivables benchmarking; institutional pricing

---

## ⛔ Do-Not-Touch List

These sources are **legal traps** dressed up as opportunities.

### Consumer Credit Data
- ❌ Experian, Equifax, TransUnion (FCRA — you'd need to be a CRA reseller)
- ❌ Trended payment history aggregators
- ❌ "Alternative data" credit scoring (LexisNexis Risk Solutions, ID Analytics) — same FCRA exposure

### Skip Tracing Vendors
- ❌ TLO, IRBSearch, Tracers, BeenVerified APIs — require licensure; FCRA territory if used for credit decisions
- These are tools for *licensed collectors*, not for SaaS data products. Revisit only when you operate the licensed buyer arm.

### Social Media Personal Data
- ❌ Facebook scraping (clear ToS violation + privacy law issues)
- ❌ Building consumer profiles from social media for resale → privacy law landmine

### Anything Behind a Paywall You Don't Pay For
- ❌ Bloomberg, S&P, etc. via scraping — copyright + ToS

### Leaked / Breached Data
- ❌ Obviously, but worth saying. Even if you find it, don't touch it.

---

## Source-by-Phase Map

| Source | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| SEC EDGAR | ✅ research | ✅ ingest | ✅ enrich | ✅ |
| CourtListener / PACER | — | ✅ partial | ✅ | ✅ |
| BLS / FRED / FDIC | — | ✅ | ✅ | ✅ |
| News RSS | ✅ | ✅ | ✅ | ✅ |
| Apify Google search | — | ✅ | ✅ | ✅ |
| Trade publications | research | optional | ✅ | ✅ |
| RMAI membership | research | — | ✅ | ✅ |
| Paid compliance feeds | — | — | optional | ✅ |
| Skip tracing | ❌ | ❌ | ❌ | ⚠️ Year 2+ only after license |

---

## Source Hygiene Rules

1. **Document the legal basis** for every source in `data_sources_registry.md` (build this in Week 4)
2. **Cache aggressively** — be a polite neighbor on free APIs
3. **Respect robots.txt** even when it would be "legal" not to
4. **Rate-limit yourself** below what the source allows
5. **User-agent honestly** — `[Brand]Bot/1.0 (+https://yourdomain.com/bot)`
6. **Re-classify yearly** — laws change; CCPA/state privacy laws expand annually

---

## What You'll Actually Build in Phase 1 (Source-Wise)

**Minimum viable data graph:**
- 50 US banks tracked via SEC EDGAR (free)
- ~5,000 bankruptcy filings/month via CourtListener (free)
- ~50 news mentions/week of debt portfolio sales via Apify Google search ($49/mo when paid)
- BLS regional data for 50 states (free)
- FDIC quarterly call report data (free)

**Total Phase 1 data cost: ~$50/mo (Apify only).** Everything else is free APIs.

That's enough to power Deal Radar + originator scoring + compliance tracker. Don't add sources until paid customers ask for them.
