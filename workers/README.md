# workers

Public-source ingestion workers for Tradeline. Phase 1 ships two:

| Worker | Source | Status |
|---|---|---|
| `sec_edgar` | data.sec.gov (free, official) | ✅ live |
| `news_rss` | Google News RSS + (later) bank IR feeds | ✅ live |
| `courtlistener` | courtlistener.com (free) | ⏳ planned |
| `state_auctions` | state public auction sites | ⏳ planned |

## Run locally

```bash
# from repo root
cd workers
python -m venv .venv && source .venv/bin/activate
pip install -e .

# back to repo root so module path resolves
cd ..
python -m workers.run                # both SEC + news
python -m workers.run --sec-only     # only SEC EDGAR
python -m workers.run --lookback-days 30   # tighter window
```

Output lands in `data/output/`:

```
data/output/
├── filings.jsonl          # every 10-Q / 10-K / 8-K observed
├── signals.jsonl          # scored signals derived from SEC filings
├── news_signals.jsonl     # news headlines matching divestiture queries
└── radar_snapshot.json    # flat snapshot consumed by apps/web
```

## What the SEC worker actually does

For each bank in `data/seed/banks.csv`:
1. Resolves ticker → CIK via the SEC's public `company_tickers.json`.
2. Hits `/submissions/CIK{cik}.json` for the recent-filings index.
3. Filters to `10-Q`, `10-K`, `8-K` within `--lookback-days` (default 120).
4. Scores each:
   - **8-K item 2.01** (Completion of Acquisition or Disposition of Assets) — high confidence, "portfolio_sale_announced" or "divestiture_announced"
   - **8-K item 2.06** (Material Impairments) — medium-high, "reserve_build"
   - **8-K item 7.01 / 8.01** referencing portfolio/loan/receivable terms — medium, "guidance_change"
   - **10-Q / 10-K** — recorded as a review window; v2 will parse MD&A
5. Dedupes on accession number across runs.

Compliance posture: all data is public, sourced via official SEC APIs, with the SEC-mandated `User-Agent` (configured in `workers/tickers.py`). **Zero consumer data is touched** — see `docs/legal/00_RED_LINES.md`.

## Schedule

For Phase 1, run manually or via local cron every 6 hours:

```cron
0 */6 * * * cd /path/to/tradeline.io && /path/to/.venv/bin/python -m workers.run
```

When MRR justifies it, move to a $0–$6/mo VPS or Cloudflare Workers cron.
