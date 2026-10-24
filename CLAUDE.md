# Tradeline — working notes for Claude

Institutional intelligence for licensed debt buyers. B2B SaaS that sources
deals, scores portfolios, and tracks compliance from public data.

## How to think (read this first)

**[docs/THE_METHOD.md](./docs/THE_METHOD.md) — "There's always a way."** When a
task looks blocked ("you need a partner API / paid feed / permission"), do NOT
accept the wall. Run the method: find the *footprint* of what you want in public
data, test the cheapest workaround first, reframe to a proxy or the other side
of the transaction, build the smallest honest thing, and verify it live. This is
the default operating mode for this project, not a special case.

## Architecture orientation

- `workers/` — Python public-source ingestion. Each source is its own module
  with a pure, unit-tested core; `run.py` orchestrates and writes
  `data/output/radar_snapshot.json`. Run a single worker with
  `python -m workers.run --<name>-only`.
- `apps/web/` — Next.js 15. Reads the snapshot via `apps/web/lib/snapshot.ts`.
- Data sources + the legal do-not-touch list: `04_DATA_SOURCES.md`.
- Compliance guardrails (FCRA/Reg F): `01_LEGAL_COMPLIANCE.md` — read before
  any feature that touches consumer-level data. We score portfolios and
  originators, never individual consumers.

## Conventions

- New public-data source → new `workers/<name>.py` with a pure core function +
  a `tests/test_<name>.py`, wired into `run.py` (pipeline + `--<name>-only` flag)
  and surfaced through the snapshot. Label proxies as proxies in the UI.
- Verify every worker against live data before claiming it works.
