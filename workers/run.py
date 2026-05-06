"""Run the full Tradeline ingestion pipeline against public sources.

Usage:
    python -m workers.run                # SEC + news
    python -m workers.run --sec-only     # SEC EDGAR only
    python -m workers.run --news-only    # Google News RSS only

Writes:
    data/output/filings.jsonl        — all SEC filings observed
    data/output/signals.jsonl        — scored signals from SEC filings
    data/output/news_signals.jsonl   — news headlines from RSS queries
    data/output/radar_snapshot.json  — flat snapshot consumed by the web app
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

from workers import news_rss, sec_edgar, storage


def _build_radar_snapshot() -> dict:
    sec_signals = storage.read_all("signals")
    filings = storage.read_all("filings")
    news = storage.read_all("news_signals")

    sec_signals.sort(key=lambda r: r.get("filed_at", ""), reverse=True)
    filings.sort(key=lambda r: r.get("filed_at", ""), reverse=True)
    news.sort(key=lambda r: r.get("published_at", ""), reverse=True)

    by_originator: dict[str, dict] = {}
    for f in filings:
        t = f.get("ticker") or f.get("cik") or "UNKNOWN"
        rec = by_originator.setdefault(
            t,
            {
                "ticker": t,
                "name": f.get("originator_name"),
                "tier": f.get("tier"),
                "filings": 0,
                "signals": 0,
                "max_confidence": 0.0,
                "last_filed_at": "",
            },
        )
        rec["filings"] += 1
        if f.get("filed_at", "") > rec["last_filed_at"]:
            rec["last_filed_at"] = f.get("filed_at", "")
    for s in sec_signals:
        t = s.get("ticker") or s.get("cik") or "UNKNOWN"
        rec = by_originator.setdefault(
            t,
            {
                "ticker": t,
                "name": s.get("originator_name"),
                "tier": s.get("tier"),
                "filings": 0,
                "signals": 0,
                "max_confidence": 0.0,
                "last_filed_at": "",
            },
        )
        rec["signals"] += 1
        rec["max_confidence"] = max(rec["max_confidence"], float(s.get("confidence") or 0))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "filings_total": len(filings),
            "sec_signals_total": len(sec_signals),
            "news_signals_total": len(news),
            "originators_with_filings": len(by_originator),
        },
        "originators": sorted(
            by_originator.values(),
            key=lambda r: (r["max_confidence"], r["signals"], r["filings"]),
            reverse=True,
        ),
        "top_signals": sec_signals[:50],
        "top_news": news[:50],
        "recent_filings": filings[:50],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sec-only", action="store_true")
    ap.add_argument("--news-only", action="store_true")
    ap.add_argument("--lookback-days", type=int, default=120)
    args = ap.parse_args()

    if not args.news_only:
        sec_summary = sec_edgar.run(lookback_days=args.lookback_days)
        print(f"[run] sec: {sec_summary}")
    if not args.sec_only:
        news_summary = news_rss.run()
        print(f"[run] news: {news_summary}")

    snap = _build_radar_snapshot()
    storage.write_snapshot("radar_snapshot", snap)
    print(
        f"[run] snapshot: {snap['summary']} -> data/output/radar_snapshot.json"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
