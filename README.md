# Tradeline

Institutional intelligence for licensed debt buyers. Hybrid path: B2B SaaS in Year 1 → licensed debt-buyer arm in Year 2.

> **Brand status:** `tradeline.io` / `.ai` / `.com` are all registered to others as of 2026-05-06. Available alternates: `tradelineos.com`, `trytradeline.com`, `paperline.io`. Decide before printing business cards.

**Capital:** under $5k starting · **Operator:** solo · **State:** TBD (Mid-Atlantic — VA / MD / NC / GA)
**Last updated:** 2026-05-06

---

## Quickstart

```bash
make setup       # bootstrap Python venv + npm workspaces + MCP build
make workers     # ingest SEC EDGAR + XBRL + news + court (~5 min)
make radar       # refresh snapshot and start http://localhost:3000
```

Or manually:

```bash
npm install
source workers/.venv/bin/activate    # if you skipped `make setup`
python -m workers.run                # SEC + XBRL + news + court
npm run dev --workspace=apps/web     # → http://localhost:3000/radar
```

Deploy: see `docs/DEPLOY.md` (Vercel + GitHub Actions cron, $0 infra).

Requires Node 20+ and Python 3.9+.

## Optional: LLM-generated talking points

Bank detail pages (`/app/banks/[ticker]`) generate context-aware sales angles
via Claude Sonnet 4.6 when `ANTHROPIC_API_KEY` is set on the server. When the
key is absent, the page falls back to deterministic template-based scaffolding
— no cost, no LLM call, identical layout. To enable:

```bash
cp apps/web/.env.example apps/web/.env.local
# edit apps/web/.env.local and add your ANTHROPIC_API_KEY
```

The system prompt is large + stable + cached server-side (5-min TTL), so repeat
views of the same bank within 5 minutes cost ~$0.001 in cache reads. Cold calls
are ~$0.025. See `apps/web/lib/talking-points-llm.ts` for the implementation.

---

## Repo layout

```
tradeline.io/
├── apps/web/              # Next.js 15 + Tailwind v4 — landing + future auth'd app
├── services/scoring/      # Python/FastAPI — portfolio scoring (Phase 2)
├── workers/               # Python — public-source ingestion (Phase 1)
├── mcp-servers/           # MCP servers for Claude/Cursor (Phase 1+)
│   ├── deal-radar/
│   ├── portfolio-pulse/
│   └── compliance-tracker/
└── docs/                  # research, legal, schemas
```

Architecture and legal guardrails: see `02_ARCHITECTURE.md` and `01_LEGAL_COMPLIANCE.md`. **Read those before adding features** — the design is shaped by FCRA constraints and breaking them collapses the stack.

---

## Roadmap docs (read in this order)

1. **[00_PROJECT_SNAPSHOT.md](./00_PROJECT_SNAPSHOT.md)** — goal, current milestone, next 3 steps
2. **[01_LEGAL_COMPLIANCE.md](./01_LEGAL_COMPLIANCE.md)** ⚠ — the four laws that govern everything; read before any code
3. **[02_ARCHITECTURE.md](./02_ARCHITECTURE.md)** — system design (Apify, Playwright, MCP, scoring)
4. **[03_PHASE_ROADMAP.md](./03_PHASE_ROADMAP.md)** — Phase 0 → Year 2, week by week
5. **[04_DATA_SOURCES.md](./04_DATA_SOURCES.md)** — legal data sources + the do-not-touch list
6. **[06_REVENUE_MODEL.md](./06_REVENUE_MODEL.md)** — pricing, unit economics, kill criteria

> `05_TECH_STACK.md` is referenced by the index but **was not in the bundle**. Will be regenerated next pass — concrete tool list lives in `02_ARCHITECTURE.md` § Component Breakdown until then.

A separate licensing research deliverable (VA / MD / NC / GA debt buyer + collector decision guide) was produced as a Claude artifact and should be saved to `docs/legal/07_LICENSING_PLAYBOOK.md` once you confirm your home state.

---

## What we ship vs. the original vision

| Original idea | Why it doesn't ship | What we ship |
|---|---|---|
| Score consumers — predict who pays | FCRA: you'd be an unregistered CRA | Score *portfolios* and *originators* using public data |
| Sell consumer data to other buyers | Privacy + CRA territory | Sell aggregated B2B market intelligence |
| Buy debt + hypothecate at 6 months | Real seasoning is 12+ mo for decent LTV | Year 2: secured paper, 12-mo seasoning |
| Fully automated find + score + sell | Only legal if you hold CRA + collector licenses | Automated *deal* + *originator-signal* aggregation |

---

## Open questions still blocking real work

- [ ] **Home state** (VA / MD / NC / GA) — drives LLC formation and Year-2 license
- [ ] **Hours/week** realistically available — 10 vs 30 changes whether the Week-12 first-revenue target is real or fantasy
- [ ] **Domain decision** — Tradeline as codename only? Buy `tradelineos.com`? Pivot to a name you can own outright?

---

## Phase 0, this week

The roadmap explicitly says **no feature code before 5 buyer-discovery calls land**. The repo skeleton above is scaffolding only. Week 1–2 work is:

1. Form LLC in your chosen state (Northwest Registered Agent or ZenBusiness, ~$100–$300)
2. EIN (free, IRS, 10 min)
3. Mercury or Relay business bank account (free)
4. **30 cold messages to RMAI / ACA member buyers — book 5 calls.** Template in `03_PHASE_ROADMAP.md` § Week 2.

If buyers don't validate the pain on those calls, the rest of this repo is wishful thinking. Run the gate before writing features.
