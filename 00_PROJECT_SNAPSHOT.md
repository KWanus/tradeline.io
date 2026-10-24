# 00 — Project Snapshot

**Last Updated:** 2026-05-05
**Codename:** *(pick one — suggestions: Tape, Performant, Recoupe, NoteRadar)*

---

## Goal (One-Liner)
Build a B2B SaaS that gives licensed debt buyers an unfair information edge — sourcing deals, scoring portfolios, and tracking compliance — then use the revenue and relationships to fund a licensed debt-buying arm in Year 2.

## Success Outcomes (Definition of Done — Year 1)
1. **$5k MRR** from 15+ paying SaaS customers (licensed debt buyers / collection agencies)
2. **2 paid research reports** sold to banks or originators ($2k–$5k each)
3. **Foundation laid** for licensed buying entity (state chosen, bond quoted, $25k+ war chest from SaaS profits)

## Hard Constraints
- **Capital:** Under $5k starting (must reach revenue before this runs out)
- **Founder:** Solo (you) — no team budget
- **Legal:** No FCRA, Reg F, GLBA, or unlicensed-buyer violations. Ever.
- **Operating state:** TBD (provide in next message — affects entity formation)
- **Timeline:** First revenue by Week 12, MRR positive by Week 26

## Current Milestone
**Phase 0 — Foundation (Weeks 1–2)**
Form entity, set up stack, validate problem with 5 buyer interviews.

## Next 3 Steps
1. Confirm operating state → form LLC (Wyoming or your home state — see `01_LEGAL_COMPLIANCE.md`)
2. Stand up the dev environment + free-tier infra (see `05_TECH_STACK.md`)
3. Book 5 customer-discovery calls with active debt buyers (RMAI member directory, LinkedIn) before writing any code

## Top Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Building before validating with real buyers | Phase 0 forces 5 calls *before* code |
| Drift into FCRA territory (consumer scoring) | `01_LEGAL_COMPLIANCE.md` red-line review at every phase gate |
| Apify/scraping cost explosion | Self-host Playwright for high-volume; Apify only for managed actors |
| $5k runway burns before MRR | Free tiers for everything in Phase 1; first paid tools only when first $1 collected |
| You try to skip ahead to buying debt | Phase gate: no licensed-buyer activity before $5k MRR + $25k war chest |

## Artifacts Index
- `00_PROJECT_SNAPSHOT.md` — this file
- `01_LEGAL_COMPLIANCE.md` — what you can/cannot do, license map
- `02_ARCHITECTURE.md` — system design (Apify, MCP, Playwright, scoring)
- `03_PHASE_ROADMAP.md` — 5 phases, week-by-week
- `04_DATA_SOURCES.md` — legal data sources, paid sources, do-not-touch list
- `05_TECH_STACK.md` — concrete tools, costs, MCP server design
- `06_REVENUE_MODEL.md` — pricing, unit economics, kill criteria

## Phase Gate Rules
- 🟢 **Green-light:** ship the recommended default and log it
- 🔴 **Red-light:** pause for explicit approval (anything legal, anything spending real money, anything touching consumer data)

## Operating Cadence
- **Daily:** 1 build block + 1 sales/research block
- **Weekly:** Update this snapshot + log one win, one blocker, one ask
- **Phase-end:** Reality Gate review (DVF) before advancing
