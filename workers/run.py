"""Run the full Tradeline ingestion pipeline against public sources.

Discovery step: every full run begins with `workers.discover`, which scans
SEC EDGAR's recent 8-K feed for bank-sector filings with NPL-relevant
items. High-confidence finds get auto-promoted into `data/seed/banks_auto.csv`
and tracked alongside the human-curated list on the next pass. Pending
candidates land in `data/output/candidates.json` for review.


Usage:
    python -m workers.run                # SEC submissions + XBRL + news
    python -m workers.run --sec-only     # SEC EDGAR submissions only
    python -m workers.run --xbrl-only    # XBRL companyfacts only
    python -m workers.run --news-only    # Google News RSS only
    python -m workers.run --fdic-only    # FDIC Call Report worker only
    python -m workers.run --no-xbrl      # SEC submissions + news, skip XBRL (fast path)

Writes:
    data/output/filings.jsonl        — all SEC filings observed
    data/output/signals.jsonl        — scored signals (SEC submissions + XBRL)
    data/output/news_signals.jsonl   — news headlines from RSS queries
    data/output/fdic_signals.jsonl   — community-bank signals from FDIC Call Reports
    data/output/radar_snapshot.json  — flat snapshot consumed by the web app
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from workers import (
    backtest,
    buyers,
    courtlistener,
    disposition_proxy,
    dispositions,
    discover,
    fdic,
    macro,
    match,
    ncua,
    news_rss,
    sec_edgar,
    storage,
    xbrl,
)
from workers.tickers import AUTO_SEED, load_banks

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "output"
CANDIDATES_PATH = OUTPUT_DIR / "candidates.json"
MACRO_PATH = OUTPUT_DIR / "macro.json"
MARKET_PRICING_PATH = OUTPUT_DIR / "market_pricing.json"


def _read_json_snapshot(path: Path) -> dict | None:
    """Read a worker-written JSON snapshot so the web app gets everything in the
    single radar snapshot."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _read_macro() -> dict | None:
    return _read_json_snapshot(MACRO_PATH)


def _read_candidates() -> list[dict]:
    if not CANDIDATES_PATH.exists():
        return []
    try:
        raw = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _auto_promoted_tickers() -> set[str]:
    """Tickers that came in via the auto-seed (so the UI can badge them)."""
    if not AUTO_SEED.exists():
        return set()
    import csv as _csv

    out: set[str] = set()
    with AUTO_SEED.open("r", encoding="utf-8") as f:
        for row in _csv.DictReader(f):
            t = (row.get("ticker") or "").strip().upper()
            if t:
                out.add(t)
    return out


def _build_radar_snapshot() -> dict:
    sec_signals = storage.read_all("signals")
    filings = storage.read_all("filings")
    news_raw = storage.read_all("news_signals")
    court_rows = storage.read_all("court_signals")
    court_rows.sort(key=lambda r: r.get("date_filed", ""), reverse=True)

    # FDIC Call Report signals — community banks, kept as their own stream
    # (FDIC institutions are keyed by certificate number, not stock ticker).
    fdic_signals = storage.read_all("fdic_signals")
    fdic_signals.sort(
        key=lambda r: (float(r.get("confidence") or 0), r.get("filed_at", "")),
        reverse=True,
    )

    # NCUA Call Report signals — credit unions, also their own stream
    # (credit unions are keyed by charter number, not stock ticker).
    ncua_signals = storage.read_all("ncua_signals")
    ncua_signals.sort(
        key=lambda r: (float(r.get("confidence") or 0), r.get("filed_at", "")),
        reverse=True,
    )

    # Signal persistence — count how many distinct quarter-ends each
    # institution has been flagged across the full JSONL history. A cert
    # that's appeared in 2+ quarters is a "persistent" signal — much
    # higher buyer interest than a one-time spike. Attach as `appearances`
    # on each signal in the snapshot so the UI can badge it.
    def _attach_appearances(rows: list[dict]) -> None:
        counts: dict[str, set[str]] = {}
        for r in rows:
            cert = str(r.get("cert") or "")
            period = str(r.get("period_end") or "")
            if not cert or not period:
                continue
            counts.setdefault(cert, set()).add(period)
        for r in rows:
            cert = str(r.get("cert") or "")
            r["appearances"] = len(counts.get(cert, set()))

    _attach_appearances(fdic_signals)
    _attach_appearances(ncua_signals)

    sec_signals.sort(key=lambda r: r.get("filed_at", ""), reverse=True)
    filings.sort(key=lambda r: r.get("filed_at", ""), reverse=True)
    news_raw.sort(key=lambda r: r.get("published_at", ""), reverse=True)

    # Attach matched tickers to each news row
    banks = load_banks()
    auto_tickers = _auto_promoted_tickers()
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
        rec = _ensure(b.ticker, name=b.name, tier=b.tier)
        # Carry asset-class focus from seed so the web app can pick a
        # sharper broker / tape estimate for SEC banks (matches the
        # per-class breakdown pattern used for FDIC community banks).
        if b.asset_class_focus:
            rec["asset_class_focus"] = b.asset_class_focus
        if b.ticker in auto_tickers:
            rec["auto_discovered"] = True
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

    candidates_all = _read_candidates()
    candidates_recent = sorted(
        candidates_all,
        key=lambda c: c.get("discovered_at", ""),
        reverse=True,
    )[:50]
    pending_candidates = [c for c in candidates_recent if not c.get("auto_promoted")]
    promoted_candidates = [c for c in candidates_recent if c.get("auto_promoted")]

    # Backtest: did a leading signal precede each disclosed disposition? Turns
    # heuristic confidence into a measured hit rate. Pool = SEC/XBRL signals +
    # Call Report flags (leading) + SEC 8-Ks + the dispositions stream (events).
    disposition_rows = storage.read_all("dispositions")
    track_record = backtest.compute_backtest(
        sec_signals + fdic_signals + ncua_signals + disposition_rows
    )

    # Standalone supply intelligence: flagged institutions whose distressed book
    # left the balance sheet this quarter (public Call Report proxy — sold or
    # written off). Not backtest ground truth; a current supply signal.
    cleared = [
        d for d in disposition_rows if d.get("signal_type") == "balance_cleared_proxy"
    ]
    # Sort by lead time first (the radar's foresight is the story), then size.
    cleared.sort(
        key=lambda d: (int(d.get("lead_days") or 0), float(d.get("drop_pct") or 0)),
        reverse=True,
    )
    early_leads = sorted(
        int(d["lead_days"]) for d in cleared if (d.get("lead_days") or 0) > 0
    )
    median_lead = (
        early_leads[len(early_leads) // 2] if early_leads else None
    )
    cleared_books = {
        "count": len(cleared),
        "as_of": cleared[0]["filed_at"][:10] if cleared else "",
        "flagged_early": len(early_leads),
        "median_lead_days": median_lead,
        "top": cleared[:25],
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "track_record": track_record,
        "cleared_books": cleared_books,
        "macro": _read_macro(),
        "market_pricing": _read_json_snapshot(MARKET_PRICING_PATH),
        "summary": {
            "filings_total": len(filings),
            "sec_signals_total": len(sec_signals),
            "news_signals_total": len(news),
            "news_signals_matched": len(matched_news),
            "court_signals_total": len(court_rows),
            "fdic_signals_total": len(fdic_signals),
            "ncua_signals_total": len(ncua_signals),
            "originators_with_filings": sum(1 for r in by_originator.values() if r["filings"] > 0),
            "auto_discovered_count": len(auto_tickers),
            "pending_candidates": len(pending_candidates),
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
        "court_signals": court_rows[:30],
        # Cap raised from 60 -> 300 so the web app's local/state filter has
        # real inventory: a buyer's own state may not crack the national
        # top-60 by confidence, but they still need to see local sellers.
        "fdic_signals": fdic_signals[:300],
        "ncua_signals": ncua_signals[:300],
        "recent_filings": filings[:50],
        "candidates_pending": pending_candidates,
        "candidates_promoted": promoted_candidates,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sec-only", action="store_true", help="run SEC EDGAR submissions worker only")
    ap.add_argument("--news-only", action="store_true", help="run Google News RSS worker only")
    ap.add_argument("--xbrl-only", action="store_true", help="run XBRL companyfacts worker only")
    ap.add_argument("--court-only", action="store_true", help="run CourtListener worker only")
    ap.add_argument("--fdic-only", action="store_true", help="run FDIC Call Report worker only")
    ap.add_argument("--ncua-only", action="store_true", help="run NCUA Call Report worker only")
    ap.add_argument("--macro-only", action="store_true", help="refresh FRED macro context (national stress + state unemployment) only")
    ap.add_argument("--no-macro", action="store_true", help="skip the macro (FRED) worker")
    ap.add_argument("--buyers-only", action="store_true", help="refresh buyer-side market pricing (cents on the dollar) only")
    ap.add_argument("--no-buyers", action="store_true", help="skip the buyer-side market pricing worker")
    ap.add_argument("--dispositions-only", action="store_true", help="ingest debt-sale disposition events (news + listings) only")
    ap.add_argument("--backtest-only", action="store_true", help="recompute the signal->disposition backtest only")
    ap.add_argument(
        "--no-xbrl",
        action="store_true",
        help="skip the XBRL worker (heavier than the others)",
    )
    ap.add_argument(
        "--no-court",
        action="store_true",
        help="skip CourtListener queries",
    )
    ap.add_argument(
        "--no-fdic",
        action="store_true",
        help="skip the FDIC Call Report worker",
    )
    ap.add_argument(
        "--no-ncua",
        action="store_true",
        help="skip the NCUA Call Report worker",
    )
    ap.add_argument(
        "--no-discover",
        action="store_true",
        help="skip the discovery scan",
    )
    ap.add_argument(
        "--discover-only",
        action="store_true",
        help="run the discovery scan only",
    )
    ap.add_argument("--lookback-days", type=int, default=120)
    args = ap.parse_args()

    only_one = (
        args.sec_only
        or args.news_only
        or args.xbrl_only
        or args.court_only
        or args.fdic_only
        or args.ncua_only
        or args.macro_only
        or args.buyers_only
        or args.dispositions_only
        or args.backtest_only
        or args.discover_only
    )

    if args.discover_only:
        print(f"[run] discover: {discover.run()}")
        return 0
    if args.macro_only:
        print(f"[run] macro: {macro.run()}")
        return 0
    if args.buyers_only:
        print(f"[run] buyers: {buyers.run()}")
        return 0
    if args.dispositions_only:
        print(f"[run] dispositions: {dispositions.run()}")
        return 0
    if args.backtest_only:
        print(f"[run] backtest: {backtest.run()}")
        return 0
    if args.xbrl_only:
        print(f"[run] xbrl: {xbrl.run()}")
    if args.sec_only:
        print(f"[run] sec: {sec_edgar.run(lookback_days=args.lookback_days)}")
    if args.news_only:
        print(f"[run] news: {news_rss.run()}")
    if args.court_only:
        print(f"[run] court: {courtlistener.run()}")
    if args.fdic_only:
        print(f"[run] fdic: {fdic.run()}")
    if args.ncua_only:
        print(f"[run] ncua: {ncua.run()}")

    if not only_one:
        # Discover first so any auto-promoted tickers get picked up by the
        # SEC/XBRL/news workers in this same run.
        if not args.no_discover:
            print(f"[run] discover: {discover.run()}")
        print(f"[run] sec: {sec_edgar.run(lookback_days=args.lookback_days)}")
        if not args.no_xbrl:
            print(f"[run] xbrl: {xbrl.run()}")
        print(f"[run] news: {news_rss.run()}")
        # Dispositions depend on the freshly-ingested news, so run after it.
        print(f"[run] dispositions: {dispositions.run()}")
        if not args.no_court:
            print(f"[run] court: {courtlistener.run()}")
        if not args.no_fdic:
            print(f"[run] fdic: {fdic.run()}")
        if not args.no_ncua:
            print(f"[run] ncua: {ncua.run()}")
        # Balance-sheet disposition proxy depends on fresh FDIC flags.
        if not args.no_fdic:
            print(f"[run] disp_proxy: {disposition_proxy.run()}")
        if not args.no_macro:
            print(f"[run] macro: {macro.run()}")
        if not args.no_buyers:
            print(f"[run] buyers: {buyers.run()}")

    snap = _build_radar_snapshot()
    storage.write_snapshot("radar_snapshot", snap)
    print(
        f"[run] snapshot: {snap['summary']} -> data/output/radar_snapshot.json"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
