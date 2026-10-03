# 01 — Legal & Compliance Guardrails

> **READ THIS BEFORE ANY CODE OR SCRAPING. The architecture in `02_ARCHITECTURE.md` is built on top of these rules. Break these and the whole stack collapses into a CFPB consent decree.**

⚠️ **This is general information, not legal advice. Before launch, get a 1-hour consult ($300–$500) with a consumer finance / FDCPA attorney. Budget allocated in `06_REVENUE_MODEL.md`.**

---

## The Four Laws That Govern Everything

### 1. FCRA — Fair Credit Reporting Act 🚨 *Most likely to trip you up*
**What it says:** If you assemble or evaluate consumer credit/payment information for use in credit, employment, insurance, or similar decisions → you are a Consumer Reporting Agency (CRA). CRAs require federal registration, annual audits, dispute resolution infrastructure.

**What this means for the original plan:**
- ❌ Scraping individual debtors' payment history to predict who will pay → **CRA territory. Do not build.**
- ❌ Selling "this person was good then hit a slump" profiles to debt buyers → **CRA territory.**
- ✅ Scoring **portfolios** (aggregate tapes the buyer already legally owns) → ok
- ✅ Scoring **originators** (which banks have which charge-off patterns) → ok
- ✅ Aggregating **public market signals** (SEC filings, court records, public auctions) → ok

**Penalty for getting it wrong:** $1k+ per violation, class actions, willful = criminal exposure.

### 2. FDCPA + Reg F — Fair Debt Collection Practices Act
**What it says:** Governs HOW debt is collected. Caps contact frequency (7 calls/week max per Reg F), requires validation notices, prohibits deceptive practices, regulates electronic communication including email/text.

**What this means:**
- Only relevant when you operate the licensed buyer (Year 2)
- Affects the SaaS only if you build collection-automation features → don't, in Phase 1
- ✅ You CAN build compliance dashboards that help buyers stay on the right side

### 3. State Debt Buyer / Collector Licensing
**What it says:** ~30+ states require a license to purchase or collect consumer debt. Examples:
- **California:** DCLA license + $25k bond
- **New York:** DCA license + $5k–$10k bond
- **Washington:** Collection Agency license + $5k bond
- **Massachusetts, Maryland, North Carolina, Texas (SOL traps), Illinois...**

**What this means:**
- **SaaS phase:** No license needed. You're software, not a buyer/collector.
- **Year 2 buyer phase:** Pick ONE state to start (cheapest + your home state usually). Costs run $1k–$10k filing + $5k–$50k bond.
- See appendix below for state-specific links.

### 4. GLBA + State Privacy Laws (CCPA/CPA/VCDPA/etc.)
**What it says:** Financial information about identifiable consumers is regulated. Sharing it requires permissible purpose + privacy notice.

**What this means:**
- ✅ B2B data products (anonymized portfolio analytics, market intelligence about banks/originators) → ok
- ❌ Selling consumer-level profiles to anyone → not ok without CRA registration

---

## The Compliant Pivot

**Your original plan said:** "Find people with high potential to pay based on their history → sell that data."

**This is the FCRA landmine.** It must change.

**Compliant version:**
- We do not score *people*. We score *portfolios*, *originators*, and *deals*.
- Buyers upload tapes they already legally possess (or evaluate before purchase under permissible purpose); our model scores the tape using public-record correlations (court records, BK filings, regional economic data).
- We sell *market intelligence* about banks (which originators charge off most, which are about to divest) — this is B2B research, not consumer reporting.

**This pivot doesn't shrink the opportunity. It sharpens it. CRAs are commodities; market intelligence isn't.**

---

## Phase Gate Compliance Checklist

Run this before advancing each phase:

- [ ] No feature scrapes or stores consumer-level financial data outside what a buyer legally provides
- [ ] No feature recommends actions about a specific named person to a third party
- [ ] All data sources documented with their legal basis (public record, ToS-permitted, paid licensed feed)
- [ ] Privacy policy + terms of service drafted (Termly: free, Iubenda: $30/yr)
- [ ] Customer agreements include: customer is licensed where required, indemnification for misuse
- [ ] No state where you market triggers a license you don't hold

## Pre-Launch Legal Spend (Allocated in $5k Budget)
| Item | Cost | When |
|---|---|---|
| LLC formation (Wyoming or home state) | $100–$500 | Week 1 |
| EIN | Free | Week 1 |
| Privacy policy / ToS template | $0–$30 | Week 4 |
| Attorney consult (FDCPA/FCRA review of pitch + ToS) | $300–$500 | Before first paid customer |
| **Total Phase 1** | **$400–$1,000** | |

## Year 2 Licensing Spend (NOT in Phase 1 budget)
| State | License Fee | Bond | Annual |
|---|---|---|---|
| Wyoming (no consumer license, but watch RMLA) | $0 | $0 | low |
| Nevada | ~$500 | $35k bond | renewal |
| Texas | varies | varies | watch SOL rules |
| California (avoid until well-funded) | $350 | $25k bond | annual |

## State to Operate From — Decision Inputs
You'll tell me your state next. Variables:
- Where you live (residency simplifies entity)
- Where customers are (you don't need their state's license to *sell SaaS*; you would need it to *buy debt* there)
- Wyoming/Delaware are popular for the entity even if you operate elsewhere

## Red Lines (Never Cross)
1. 🚨 No scraping of consumer credit data, payment data, or assembling consumer profiles for resale
2. 🚨 No automated outreach to named debtors (that's collection, not SaaS)
3. 🚨 No "we'll predict if [Person X] will pay" as a feature
4. 🚨 No purchasing debt before licensing in target state(s)
5. 🚨 No promising customers anything we haven't legally verified

## Useful References
- CFPB Reg F summary: consumerfinance.gov
- FCRA full text: 15 U.S.C. § 1681
- RMAI (industry trade group): rmaintl.org
- ACA International: acainternational.org
- Each state AG / financial regulator site for licensing
