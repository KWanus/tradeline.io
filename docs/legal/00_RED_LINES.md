# Red Lines — what this codebase will not do

> Sister doc to `01_LEGAL_COMPLIANCE.md`. Lives next to the code so it's seen at PR time.

This is not a values statement. Each line below traces to a specific federal or state statute. Crossing one collapses the entire stack into a CFPB consent decree, regulator action, or felony exposure. The architecture in `02_ARCHITECTURE.md` is built to make these impossible by construction.

## Hard refusals

| # | Refused capability | Statute |
|---|---|---|
| 1 | Scrape, store, or score consumer credit / payment history at the individual level | FCRA — would make us a Consumer Reporting Agency |
| 2 | Sell, share, or surface consumer-level profiles to any third party | FCRA + GLBA + state privacy (CCPA, CPA, VCDPA, …) |
| 3 | Recommend, predict, or rank a specific named consumer to a third party | FCRA |
| 4 | Help an unlicensed party purchase, attempt to purchase, or arrange the purchase of consumer debt | State debt-buyer / collector licensing (~30 states) |
| 5 | Automate outreach to consumers — calls, texts, emails | FDCPA + Reg F (CFPB 2021) |
| 6 | Skip-trace consumers via TLO / IRBSearch / Tracers / similar | FCRA + licensing |
| 7 | Ingest or process leaked / breached datasets, even if found "in the open" | Computer Fraud + state law |
| 8 | Scrape behind paywalls (Bloomberg, S&P, etc.) | Copyright + ToS |

## "But the user asked for it" doesn't move the line

If a feature request matches any of the above, it does not get a flag, an env var, or a "test mode." It does not ship. Pivot the feature so it operates on the **portfolio** or **originator** level using public data.

## What we DO ship — and why it's compliant

| Capability | Why it's in bounds |
|---|---|
| Scan public SEC filings for bank charge-off and divestiture signals | Public records, official free API |
| Aggregate court / bankruptcy filings via CourtListener / RECAP | Public records |
| Aggregate news + bank IR press releases | Publicly disclosed by issuer |
| Score uploaded portfolios that the customer legally holds | Customer is the data controller; we process for them, output stays portfolio-level |
| Score originator health using SEC + FDIC + FFIEC data | All public, all aggregate |
| Sell B2B market-intelligence reports about banks | B2B research, not consumer reporting |
| Compliance tracker for state-by-state buyer/collector rules | Public statutes |

## When in doubt

If a teammate (or a future agent) is unsure whether a capability crosses a line: **stop, write up the proposed feature as if for a CFPB examiner, and have a consumer-finance attorney review it before the code merges.** The $300–$500 attorney consult is in the budget specifically for this.
