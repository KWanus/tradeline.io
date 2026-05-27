# Operator-OS Shiplog — 2026-05-25

Session ship notes for the operator-OS spine + the polish layers built
on top of it: 25 commits live on `origin/main`. Source for future
public-changelog promotion.

---

## Operator surfaces — what's visible where

| Surface | Pillar(s) | When it appears |
|---|---|---|
| Topbar pill `OS · …` | All | Always on every /app/* page (md+) |
| UrgentNotificationPing (floating corner chip) | Compliance + Returns + Capital | Always when an unacked urgent item exists |
| Sidebar urgency badge on `/app/compliance` | Compliance | When urgent licenses exist |
| /app/today OsSetupCard | All | When one or more spine stores unconfigured |
| /app/today LicenseExpiryBanner | Compliance | When expiring or expired licenses exist |
| /app/today RuleChangeBanner | Regulatory | When unread state-rule changes affect licensed states |
| /app/today UrgentQueue | Cross-pillar | When cross-pillar urgent items exist |
| /app/today RecentActivityPanel | All | When activity log non-empty |
| /app/today DailyBriefing | AI synthesis | Auto-fires daily (Auto toggle persists opt-out) |
| /app/compliance gap analysis | Compliance | Always |
| /app/compliance state-rule changelog | Regulatory | Always |
| /app/capital bid envelope + return forecast | Capital + concentration + license | Always when configured |
| /app/portfolio performance dashboard + curve | Portfolio + collections | When holdings exist |
| /app/portfolio won-deals panel | Pipeline → portfolio bridge | When won deals not yet converted |
| /app/portfolio returns tracker + per-holding chart | Returns | When holdings exist |
| /app/tools/tape recent-decodes picker | Activity-derived | When tape decodes in activity log |
| /app/tools/tape 12-section decode flow | All (per tape) | After upload |
| /app/tools/bid-calculator comp-set panel | Pricing | Always |

---

## Tape Copilot — the full decision package after a decode

1. **Aggregates** — accounts, face, avg/median, distributions (existing)
2. **Schema & compliance** — 60-field canonical schema (Spiegel-Midland +
   Reg F + OCC + RMAI), schema grade A-F, Reg F minimum-field check,
   originator fingerprint (CompuCredit/Spiegel/CardWorks/fintech/broker)
   with balance-convention warning catching the 10-30% mispricing trap,
   per-category completeness bars, expandable 60-field detail
3. **SOL report** — per-account statute computation across 50-state matrix,
   lapsed/cliff_30/cliff_90/cliff_180/healthy buckets, anchor-mix
   transparency, **cliff queue CSV export** (row indices only)
4. **License coverage** — pulls from `/app/compliance` License[] records,
   covered vs uncovered face %, expiring-soon callout per state
5. **Concentration limits** — inline policy editor; breach list with
   severity badges
6. **Rule-change alerts** — recent state regulatory changes that touch
   THIS tape's state/asset mix, affected face $/%, source citations
7. **Cross-tape match check (double-sold)** — async fingerprint (SHA-256
   with per-installation salt, no PII stored), check vs all prior saved
   tapes, matched rows CSV + fingerprint history panel
8. **Chain-of-custody reconciliation** — drag seller media zip, fflate
   parses in-browser, classifies docs by filename, scores enforceability
   per account → "enforceable face value vs quoted face" + missing-docs
   CSV
9. **Distributions** — geographic, vintage, asset-class
10. **Bid heuristic** + **comp-set callout** — industry preset vs operator's
    own historical bid + win rate + realized multiple from /app/pipeline +
    /app/portfolio
11. **Capital impact inline** — post-bid available capital + asset-class
    concentration shift + OK/WARN/BLOCK
12. **Servicer match** — rank operator's servicers by predicted recovery
    on this tape's profile, with confidence tiers + industry benchmark
    fallback; chosen servicer flows into pipeline → holding auto-fill
13. **Underwriting memo** — AI-synthesized 1-page sign-off-ready markdown
    via `/api/tape-memo` (Claude Sonnet 4.6, sanitized payload, no PII)
14. **Save to Pipeline** — deal notes carry the full decision context
    (schema/Reg F/SOL/license/concentration/cross-tape/chain-of-custody/
    bid/capital/servicer/rule alerts) so the operator can reconstruct
    the rationale weeks later

---

## Cross-pillar workflow loops shipped

- **Decode → Pipeline → Holding** — Tape Copilot save records servicer
  recommendation on the deal; WonDealsPanel on /app/portfolio surfaces
  won deals not yet converted with one-click "Convert to holding" that
  pre-fills face/paid/asset/servicer/vintage; no re-entry
- **Compliance store consolidation** — Tape Copilot license card reads
  from `/app/compliance` License[] (rich records) first via
  EffectiveLicenseMap, falls back to simple LicensePolicy
- **License coverage + concentration → bid envelope** — /app/capital
  envelope joins capital state + pipeline + portfolio + concentration +
  license map to answer "what can I safely bid this week"
- **Activity log → AI context** — every tape decode, license config,
  capital config, return flag, deal conversion logs to a 200-entry ring
  buffer at `tradeline.activity-log.v1`; appended to AI userContext so
  briefing + tutor get temporal awareness
- **Spine state → topbar pill** — three-state OS health (unconfigured /
  urgent / healthy) always visible
- **Spine state → urgent ping** — proactive corner chip surfaces lapsed
  licenses + expired return windows + capital over-commit on every
  /app/* page, with tiered ack keys so a 30d-ack doesn't suppress a
  later 7d alert

---

## Privacy posture preserved end-to-end

- Tape rows discarded after aggregates computed
- Fingerprint hashes use per-install salt + only hashes persisted (no PII)
- Chain-of-custody account-key matching uses operator's own tape in
  `useRef`, never transmitted
- Cliff queue / matched-rows / missing-docs / returns CSV exports use
  row indices only — operator joins back to their own tape for PII
- LLM memo payload sanitized — no raw header strings, no row data
- Server-side compliance check on /api/send-outreach accepts licenses
  in request body (defense-in-depth) but never persists them server-side
- All operator policy stores in localStorage; opt-in GitHub backup for
  returns (other stores can adopt the same pattern)
- AI activity log is fully client-local; only the formatted summary
  appears in the LLM prompt — no individual entry IDs cross the wire

---

## 25 commits (chronological)

| # | SHA | Headline |
|---|---|---|
| 1 | `24bab03` | feat(tape-copilot): operator OS — schema, SOL, license, concentration, memo, chain-of-custody |
| 2 | `65b283a` | feat(compliance): real-time shield — pre-send gate, expiry banner, sidebar badge, gap analysis |
| 3 | `cf43f0f` | feat(capital): bid envelope — what you can safely bid this week |
| 4 | `0380d97` | feat(capital): expected-return forecast + Tape Copilot capital-impact inline |
| 5 | `5c5596c` | feat(bid-calculator): comp-set pricing — operator's own realized history replaces industry defaults |
| 6 | `633208e` | feat(tape-copilot): cross-tape double-sold detection — V3 network-effect moat |
| 7 | `dc32edc` | feat(portfolio): live performance dashboard — model fit, cash velocity, 90d forecast, per-servicer/vintage/asset rollups |
| 8 | `eb96b3d` | feat(tape-copilot): servicer match — rank placement options by predicted recovery |
| 9 | `2489f26` | feat(portfolio): returns & refunds tracker — window urgency + notice generator |
| 10 | `2a2edcc` | feat(spine): opt-in GitHub backup + unified urgent queue + shiplog |
| 11 | `b952c8e` | feat(today): operator-OS setup card — 30s configuration so the spine lights up day 1 |
| 12 | `1f198a1` | feat(ai-context): spine awareness — briefing + tutor now know your operator-OS state |
| 13 | `c429ca6` | feat(portfolio): one-click pipeline-won → holding conversion |
| 14 | `4e9816a` | feat(portfolio): collections curve — actual vs model SVG chart on the performance dashboard |
| 15 | `387d183` | feat(compliance): state-rule changelog — recent regulatory changes affecting your licensed states |
| 16 | `e9bbc3c` | feat(tape-copilot): rule-change alerts inline at bid time |
| 17 | `1cda130` | feat(portfolio): per-holding collections curve in RemittanceTracker |
| 18 | `52e69d2` | feat(ai-context): activity log — temporal awareness for briefing + tutor |
| 19 | `2a0a60f` | feat(tape-copilot): pipeline save now carries full decision context |
| 20 | `263c7e4` | feat(today): recent-activity panel — visible parity with what the AI sees |
| 21 | `b6cf804` | feat(app): urgent notification ping — proactive surfacing on every /app/* page |
| 22 | `13d3e4d` | feat(workflow): Tape Copilot servicer rec → pipeline deal → holding auto-fill |
| 23 | `324354b` | feat(today): daily briefing auto-fires on first visit each day |
| 24 | `0d50f54` | feat(tape-copilot): recent-decodes picker — operator memory of evaluated tapes |
| 25 | `c0c4965` | feat(topbar): spine-state badge — always-visible OS health pill |

---

## What's not built yet

- **Federated cross-operator features** — V2 double-sold bloom filter
  compression, liquidity-intel pricing benchmarks. Gated on N≥10
  operators on the rails.
- **Auto-sync of server-side stores** — opt-in manual sync only (returns
  store has Backup/Restore buttons); auto-sync needs auth + conflict
  resolution.
- **Multi-tenant** — V1 single-tenant. Server-store path scheme already
  partitions by tenant, so flipping the switch is straightforward.
- **Pipeline / compliance store activity-log integration** — touches
  user's parallel WIP; not yet wired.
- **AI tutor proactive prompts** — temporal context flows in (activity
  log), but the tutor doesn't volunteer prompts based on it yet.

---

## How to verify locally

1. `cd apps/web && npm run dev`
2. Visit `/app/compliance` → "Load demo licenses" to seed compliance
3. Visit `/app/today` → expect OS setup card (until configured),
   briefing auto-firing, urgent queue + recent activity once events
   accrue
4. Visit `/app/tools/tape` → recent-decodes picker on top; click
   "Fresh credit card · $2.1M face" sample → walk all 14 sections
5. Visit `/app/portfolio` → performance dashboard + collections curve +
   won-deals panel + returns tracker + per-holding charts
6. Visit `/app/capital` → bid envelope + return forecast
7. Visit `/app/tools/bid-calculator` → comp-set panel above existing
   calculator
8. Topbar should show three pills on desktop: spine-state (`OS · …`),
   Autopilot, profile
9. Corner chip (bottom-right) should appear when urgent items exist
10. For the underwriting memo to render, set `ANTHROPIC_API_KEY` in
    `.env.local`
