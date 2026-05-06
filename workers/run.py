"""Run the full Tradeline ingestion pipeline against public sources.

Usage:
    python -m workers.run                # SEC submissions + XBRL + news
    python -m workers.run --sec-only     # SEC EDGAR submissions only
    python -m workers.run --xbrl-only    # XBRL companyfacts only
    python -m workers.run --news-only    # Google News RSS only
    python -m workers.run --no-xbrl      # SEC submissions + news, skip XBRL (fast path)

Writes:
    data/output/filings.jsonl        — all SEC filings observed
    data/output/signals.jsonl        — scored signals (SEC submissions + XBRL)
    data/output/news_signals.jsonl   — news headlines from RSS queries
    data/output/radar_snapshot.json  — flat snapshot consumed by the web app
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone

from workers import match, news_rss, sec_edgar, storage, xbrl
from workers.tickers import load_banks


def _build_radar_snapshot() -> dict:
    sec_signals = storage.read_all("signals")
    filings = storage.read_all("filings")
    news_raw = storage.read_all("news_signals")

    sec_signals.sort(key=lambda r: r.get("filed_at", ""), reverse=True)
    filings.sort(key=lambda r: r.get("filed_at", ""), reverse=True)
    news_raw.sort(key=lambda r: r.get("published_at", ""), reverse=True)

    # Attach matched tickers to each news row
    banks = load_banks()
    news = match.match_news(news_raw, banks)
    news_by_ticker = match.news_by_ticker(news)

    by_originator: dict[str, dict] = {}

    def _ensure(ticker: str, name=None, tier=None) -> dict:
        return by_originator.setdefault(
            ticker,
            {
                "ticker": ticker,
                "name": name,
                "tier": tier,
                "filings": 0,
                "signals": 0,
                "news_mentions": 0,
                "max_confidence": 0.0,
                "last_filed_at": "",
            },
        )

    for b in banks:
        _ensure(b.ticker, name=b.name, tier=b.tier)
    for f in filings:
        rec = _ensure(
            f.get("ticker") or f.get("cik") or "UNKNOWN",
            name=f.get("originator_name"),
            tier=f.get("tier"),
        )
        rec["filings"] += 1
        if f.get("filed_at", "") > rec["last_filed_at"]:
            rec["last_filed_at"] = f.get("filed_at", "")
    for s in sec_signals:
        rec = _ensure(
            s.get("ticker") or s.get("cik") or "UNKNOWN",
            name=s.get("originator_name"),
            tier=s.get("tier"),
        )
        rec["signals"] += 1
        rec["max_confidence"] = max(rec["max_confidence"], float(s.get("confidence") or 0))
    for ticker, news_list in news_by_ticker.items():
        rec = _ensure(ticker)
        rec["news_mentions"] = len(news_list)

    matched_news = [n for n in news if n.get("matched_tickers")]
    matched_news.sort(key=lambda r: r.get("published_at", ""), reverse=True)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "filings_total": len(filings),
            "sec_signals_total": len(sec_signals),
            "news_signals_total": len(news),
            "news_signals_matched": len(matched_news),
            "originators_with_filings": sum(1 for r in by_originator.values() if r["filings"] > 0),
        },
        "originators": sorted(
            by_originator.values(),
            key=lambda r: (
                r["max_confidence"],
                r["signals"],
                r["news_mentions"],
                r["filings"],
            ),
            reverse=True,
        ),
        "top_signals": sec_signals[:50],
        "top_news": news[:50],
        "matched_news": matched_news[:50],
        "recent_filings": filings[:50],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sec-only", action="store_true", help="run SEC EDGAR submissions worker only")
    ap.add_argument("--news-only", action="store_true", help="run Google News RSS worker only")
    ap.add_argument("--xbrl-only", action="store_true", help="run XBRL companyfacts worker only")
    ap.add_argument(
        "--no-xbrl",
        action="store_true",
        help="skip the XBRL worker (heavier than the others)",
    )
    ap.add_argument("--lookback-days", type=int, default=120)
    args = ap.parse_args()

    only_one = args.sec_only or args.news_only or args.xbrl_only

    if args.xbrl_only:
        print(f"[run] xbrl: {xbrl.run()}")
    if args.sec_only:
        print(f"[run] sec: {sec_edgar.run(lookback_days=args.lookback_days)}")
    if args.news_only:
        print(f"[run] news: {news_rss.run()}")

    if not only_one:
        print(f"[run] sec: {sec_edgar.run(lookback_days=args.lookback_days)}")
        if not args.no_xbrl:
            print(f"[run] xbrl: {xbrl.run()}")
        print(f"[run] news: {news_rss.run()}")

    snap = _build_radar_snapshot()
    storage.write_snapshot("radar_snapshot", snap)
    print(
        f"[run] snapshot: {snap['summary']} -> data/output/radar_snapshot.json"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
