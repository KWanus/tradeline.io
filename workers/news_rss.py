"""News RSS worker — Google News + (later) bank IR feeds for divestiture chatter.

Pure stdlib + feedparser. No paid sources, no scraping behind paywalls.
Outputs are *raw signals* — they need de-duping against SEC filings later.
"""

from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from typing import Any

import feedparser

from workers import storage

# Google News exposes search as RSS. We pre-author a few queries that target
# the seller side of the market — banks announcing portfolio sales,
# advisors marketing tapes, regulator-driven divestitures.
QUERIES: tuple[tuple[str, str], ...] = (
    ("npl_portfolio_sale", '"non-performing loan" portfolio sale bank'),
    ("debt_portfolio_sale", '"debt portfolio" sale OR auction bank'),
    ("charge_off_sale", '"charge-off" portfolio sale bank'),
    ("receivables_divestiture", "receivables divestiture bank"),
    ("auto_loan_sale", "auto loan portfolio sale bank"),
    ("credit_card_receivables", '"credit card receivables" sold bank'),
    ("medical_debt_sold", "medical debt portfolio sold"),
    ("nlex_listing", "NLEX listing receivables tape"),
    ("garnet_capital", '"Garnet Capital" portfolio'),
)

GOOGLE_NEWS_RSS = (
    "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
)


def _entry_id(entry: Any) -> str:
    base = (entry.get("id") or entry.get("link") or entry.get("title") or "").encode("utf-8")
    return hashlib.sha1(base).hexdigest()[:16]


def _parse_published(entry: Any) -> str:
    pp = entry.get("published_parsed")
    if pp:
        return datetime(*pp[:6], tzinfo=timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def fetch_query(label: str, q: str) -> list[dict[str, Any]]:
    url = GOOGLE_NEWS_RSS.format(q=q.replace(" ", "+"))
    feed = feedparser.parse(url)
    rows: list[dict[str, Any]] = []
    for entry in feed.entries[:50]:  # cap per query
        rows.append(
            {
                "source": "news_google",
                "source_id": _entry_id(entry),
                "query_label": label,
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published_at": _parse_published(entry),
                "summary": entry.get("summary", "")[:1000],
                "publisher": (entry.get("source", {}) or {}).get("title", ""),
            }
        )
    return rows


def run() -> dict[str, int]:
    all_rows: list[dict[str, Any]] = []
    print(f"[news_rss] running {len(QUERIES)} Google News queries")
    for label, q in QUERIES:
        try:
            rows = fetch_query(label, q)
            print(f"[news_rss] {label}: {len(rows)} entries")
            all_rows.extend(rows)
        except Exception as e:  # feedparser is forgiving; this is for network blips
            print(f"[news_rss] {label} failed: {e}")
        time.sleep(0.5)
    written = storage.append("news_signals", all_rows, key_fields=("source", "source_id"))
    return {"seen": len(all_rows), "new": written}


if __name__ == "__main__":
    print(f"[news_rss] done: {run()}")
