# workers

Self-hosted ingestion workers (Playwright + native API clients). Designed to run on a $0–$6/mo VPS or Oracle Cloud Always Free tier.

## Planned Phase 1 workers

| Worker | Source | Cadence | Cost |
|---|---|---|---|
| `worker_sec_edgar.py` | data.sec.gov (free API) | 6h | $0 |
| `worker_courtlistener.py` | courtlistener.com (free API) | daily | $0 |
| `worker_news_rss.py` | bank IR + Google News RSS | 6h | $0 |
| `worker_state_auctions.py` | state public auction sites | daily | $0 |

Each worker writes to the Supabase `deals` / `originators` / `filings` tables via service role.

## Status

Stub. Build begins Week 4 per `03_PHASE_ROADMAP.md`.
