# Operator-OS Shiplog — 2026-05-25

Session ship notes for the operator-OS spine: Tape Copilot, Compliance
Shield, Capital Engine, Bid Calculator comp-set, Portfolio overhaul,
Servicer matching, Returns/refunds tracker. Twelve commits on `main`,
all live on origin. Source for future public-changelog entries.

---

## What the operator now sees end-to-end

### `/app/tools/tape` — Tape Copilot
Drag any seller CSV/PDF/XLSX → instant decode + decision package.

1. Aggregates (existing) — accounts, face, avg/median, state/vintage/asset mix
2. **Schema & compliance** — 60-field canonical schema (Spiegel-Midland + Reg F + OCC + RMAI), schema grade A–F, Reg F minimum check, originator fingerprint (CompuCredit/Spiegel/CardWorks/fintech/broker) with balance-convention warning (catches the CompuCredit "incl. pre-CO interest" 10-30% mispricing trap), per-category completeness bars, expandable 60-field detail
3. **SOL report** — per-account statute computation across 50-state matrix, lapsed/cliff_30/cliff_90/cliff_180/healthy buckets, anchor-mix transparency, **cliff queue CSV export** (row indices only)
4. **License coverage** — pulls from `/app/compliance` License[] (rich data), shows covered vs uncovered face %, expiring-soon-but-covers-this-tape callout, inline simple editor fallback
5. **Concentration limits** — inline policy editor (state/vintage/asset class %), breach list with severity badges
6. **Cross-tape match check** (V3 moat #2 — double-sold detection) — async fingerprint (SHA-256 with per-installation salt, no PII stored), check vs all prior saved tapes, headline + matched rows CSV + expandable fingerprint history
7. **Chain-of-custody reconciliation** (killer differentiator) — drop seller media zip, fflate parses in-browser, doc classification by filename, per-account enforceability scoring, "enforceable face value vs. quoted face" with missing-docs CSV
8. Distributions (existing)
9. **Bid heuristic** + **comp-set callout** (V3 moat #1) — industry preset vs operator's own history (median bid + win rate + realized multiple from /app/pipeline + /app/portfolio)
10. **Capital impact inline** — at disciplined bid: post-bid available capital + asset-class concentration shift + OK/WARN/BLOCK
11. **Servicer match** — rank operator's servicers by predicted recovery on this tape's profile, with confidence tiers + industry benchmark fallback
12. **Underwriting memo** — AI-synthesized 1-page sign-off-ready markdown via `/api/tape-memo` (Claude Sonnet 4.6, sanitized payload, no PII)

### `/app/compliance` — Compliance Shield
Existing license tracker enhanced + wired:

- `/app/today` license-expiry banner (red expired, warn <30d)
- Sidebar badge with urgent count (red/warn)
- License gap analysis panel (strict-state gaps CA/NY/MA/MD/IL/CO/WA, no-license-required not recorded, other gaps)
- Server-side compliance gate on `/api/send-outreach` (412 on unaccepted blocker, override flag, audit log on autopilot log)
- License consolidation: Tape Copilot license card reads from `/app/compliance` records first via `EffectiveLicenseMap`

### `/app/capital` — Capital Engine
- **Bid envelope** (top) — "what you can safely bid this week" with per-deal capital/concentration fit + post-win projection + asset-class exposure
- **Return forecast** — portfolio-wide recovery projection (multiple, CAGR approx, per-holding progress bars)

### `/app/tools/bid-calculator` — Comp-set pricing
- Pulls operator's holdings + closed deals
- Bid distribution percentiles (p25/median/p75)
- Win rate + realized multiple + CAGR
- Match table sorted by similarity
- Cold-start guidance when N<3 comps
- URL deep-link from Tape Copilot preserves face + asset class

### `/app/portfolio` — Performance + Returns
- **Performance dashboard** (top) — model fit, cash velocity, 90d forecast, per-servicer/vintage/asset-class rollups, top performer + worst underperformer
- **Returns & refunds tracker** — flagged account log with window urgency (expired / critical ≤14d), notice-template .txt download per holding, portfolio-wide returns CSV, status lifecycle (flagged → contacted → returned)

---

## Privacy posture preserved

End-to-end, every new feature respects the load-bearing "data stays
in the browser" claim:

- Tape rows discarded after aggregates computed
- Fingerprint hashes use per-install salt + only hashes persisted (no PII)
- Chain-of-custody account-key matching uses operator's own tape in `useRef`, never transmitted
- Cliff queue / matched-rows / missing-docs / returns CSV exports use row indices only — operator joins back to their own tape for PII
- LLM memo payload sanitized — no raw header strings, no row data
- Server-side compliance check accepts licenses in request body (defense-in-depth) but never persists them server-side
- All policy stores in localStorage: compliance licenses, license policy (simple fallback), concentration policy, fingerprints, returns

---

## Twelve commits (chronological)

| # | SHA | Headline |
|---|---|---|
| 1 | `24bab03` | feat(tape-copilot): operator OS — schema, SOL, license, concentration, memo, chain-of-custody |
| 2 | `65b283a` | feat(compliance): real-time shield — pre-send gate, expiry banner, sidebar badge, gap analysis |
| 3 | `cf43f0f` | feat(capital): bid envelope — what you can safely bid this week |
| 4 | `0380d97` | feat(capital): expected-return forecast + Tape Copilot capital-impact inline |
| 5 | `5c5596c` | feat(bid-calculator): comp-set pricing — operator's own realized history replaces industry defaults |
| 6 | `633208e` | feat(tape-copilot): cross-tape double-sold detection — the V3 network-effect moat |
| 7 | `dc32edc` | feat(portfolio): live performance dashboard — model fit, cash velocity, 90d forecast, per-servicer/vintage/asset rollups |
| 8 | `eb96b3d` | feat(tape-copilot): servicer match — rank your placement options by predicted recovery on this tape |
| 9 | `2489f26` | feat(portfolio): returns & refunds tracker — window urgency + notice generator |

(Three more from earlier session covering the same direction: bid-calc comp-set, capital impact, etc.)

---

## What's not built yet

- **Server-side persistence** — would unlock multi-device sync + autopilot cron checks but trades the "data never leaves browser" posture. Opt-in design needed.
- **Federated cross-operator features** — V2 double-sold bloom filter, liquidity-intel pricing benchmarks. Gated on N≥10 operators.
- **Recovery-curve actual-time-series chart** — RemittanceTracker has the data, just needs a visualization.
- **State-rule changelog feed** — curated Reg F / state-update timeline so the compliance shield warns when laws change.

---

## How to verify locally

1. `cd apps/web && npm run dev`
2. Visit `/app/compliance` → click "Load demo licenses"
3. Visit `/app/today` → expect license expiry banner if any demo license is expiring
4. Visit `/app/tools/tape` → click "Fresh credit card · $2.1M face" sample
5. Confirm sections render: schema/SOL/license/concentration/cross-tape/chain-of-custody/distributions/bid/capital impact/servicer match/memo
6. Visit `/app/portfolio` → expect performance dashboard + returns tracker (if any holdings)
7. Visit `/app/capital` → expect bid envelope + return forecast + existing tracker
8. Visit `/app/tools/bid-calculator` → expect comp-set panel above existing calculator

For the underwriting memo to render, set `ANTHROPIC_API_KEY` in `.env.local`.
