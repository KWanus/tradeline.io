"""Dispositions worker — real debt-sale ground truth for the backtest.

The backtest needs *confirmed debt-portfolio sales* to score the radar against.
SEC 8-K item 2.01 mostly surfaces M&A from large public banks, not charge-off
sales (those transact privately). This worker fills that gap from two compliant
sources, normalized into one `dispositions` stream the backtest treats as
CONFIRMED events:

  1. NEWS CLASSIFIER — over the news we already pull (Google News RSS, public
     press releases), detect headlines that announce a *completed/agreed*
     portfolio sale (not mere chatter) and match them to a known originator.
     Conservative on purpose: a false "confirmed sale" poisons ground truth.

  2. MANUAL / MARKETPLACE CSV — data/seed/listings.csv, maintained by the
     operator from marketplaces they legitimately access (EverChain, Debexpert,
     NLEX, Garnet). We deliberately do NOT scrape those — they are closed,
     login-gated networks and this project respects ToS/robots. The operator,
     who has accounts, records what they see; a future partner-API adapter can
     drop into the same `dispositions` shape.

Output: data/output/dispositions.jsonl. Each row carries
signal_type="portfolio_sale_announced" so backtest.compute_backtest counts it
as a confirmed debt sale, plus provenance (`disposition_source`, `marketplace`).

Compliance: public news + operator-entered data only. No scraping behind logins.
No consumer data.
"""

from __future__ import annotations

import csv
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from workers import match, storage
from workers.tickers import Bank, load_banks

ROOT = Path(__file__).resolve().parent.parent
LISTINGS_CSV = ROOT / "data" / "seed" / "listings.csv"

# A portfolio/loan noun must appear — otherwise "completed the sale of its
# headquarters" would register as a debt sale.
PORTFOLIO_NOUN = re.compile(
    r"\b(portfolio|receivabl\w+|loan[s]?|note[s]?|tape|charge[\- ]?off\w*|npl[s]?|"
    r"non[\- ]?performing|credit[\- ]card|auto loan|medical debt)\b",
    re.IGNORECASE,
)

# Sale-completion language — an event, not speculation. Ordered by strength.
SALE_PATTERNS: tuple[tuple[str, float], ...] = (
    (r"complet\w+ (?:the )?sale of", 0.9),
    (r"\bsold\b", 0.8),
    (r"agree\w* to sell", 0.8),
    (r"\bdivest\w+\b", 0.75),
    (r"(?:auction\w*|sale) of .{0,40}(?:portfolio|receivabl\w+|tape)", 0.8),
    (r"\bto sell\b", 0.65),
)

# Words that flip a "sold/sale" headline into a non-debt or non-event meaning.
NEGATIVE_CONTEXT = re.compile(
    r"\b(headquarters|branch(?:es)?|building|real estate|stock|shares|"
    r"insurance unit|subsidiary stake|rumor|considering|exploring|may sell|"
    r"could sell|weighing)\b",
    re.IGNORECASE,
)

ASSET_CLASS_PATTERNS: tuple[tuple[str, str], ...] = (
    ("credit_card", r"credit[\- ]card"),
    ("auto", r"\bauto\b|vehicle|automobile"),
    ("medical", r"medical|healthcare"),
    ("mortgage", r"mortgage|residential|home loan"),
    ("student", r"student loan"),
    ("consumer", r"consumer|installment|personal loan"),
)


def _infer_asset_class(text: str) -> str:
    for label, pat in ASSET_CLASS_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return label
    return ""


def _hash(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


def classify_news_sales(
    news: list[dict[str, Any]], banks: list[Bank]
) -> list[dict[str, Any]]:
    """Promote completed-sale news to confirmed disposition events.

    A row qualifies only when ALL hold: a sale-completion phrase, a
    portfolio/loan noun, no negative context, and a matched seed originator.
    """
    by_ticker = {b.ticker: b for b in banks}
    matched = match.match_news(news, banks)
    out: list[dict[str, Any]] = []

    for n in matched:
        tickers = n.get("matched_tickers") or []
        if not tickers:
            continue
        text = f"{n.get('title') or ''} {n.get('summary') or ''}"
        if not PORTFOLIO_NOUN.search(text):
            continue
        if NEGATIVE_CONTEXT.search(text):
            continue
        conf = 0.0
        for pat, weight in SALE_PATTERNS:
            if re.search(pat, text, re.IGNORECASE):
                conf = max(conf, weight)
        if conf == 0.0:
            continue

        asset_class = _infer_asset_class(text)
        published = n.get("published_at") or datetime.now(timezone.utc).isoformat()
        for ticker in tickers:
            bank = by_ticker.get(ticker)
            out.append(
                {
                    "source": "disposition_news",
                    "source_id": _hash("news", str(n.get("source_id") or ""), ticker),
                    "signal_type": "portfolio_sale_announced",
                    "disposition_source": "news",
                    "marketplace": n.get("publisher") or "",
                    "ticker": ticker,
                    "cik": bank.cik if bank else "",
                    "originator_name": bank.name if bank else ticker,
                    "asset_class": asset_class,
                    "confidence": round(conf, 2),
                    "filed_at": published,
                    "url": n.get("link") or "",
                    "title": (n.get("title") or "")[:300],
                    "rationale": f"news sale match ({conf:.2f}) on {ticker}",
                }
            )
    return out


def load_manual_listings(path: Path = LISTINGS_CSV) -> list[dict[str, Any]]:
    """Operator-maintained marketplace listings (EverChain/Debexpert/NLEX/etc.).

    CSV columns (all but date + originator_name optional):
      date, originator_name, ticker, cik, asset_class, face_value_usd,
      marketplace, url, note
    `ticker` may be a stock ticker OR an "FDIC-1234" / "NCUA-1234" key to force
    a match against a Call Report leading signal.
    """
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("originator_name") or "").strip()
            date = (row.get("date") or "").strip()
            # Skip blanks and # comment lines (incl. commented example rows).
            if not name or not date or date.startswith("#") or name.startswith("#"):
                continue
            # Accept YYYY-MM-DD; normalize to an ISO timestamp.
            filed_at = f"{date}T00:00:00+00:00" if len(date) == 10 else date
            marketplace = (row.get("marketplace") or "").strip()
            out.append(
                {
                    "source": "disposition_listing",
                    "source_id": _hash("listing", date, name.lower(), marketplace.lower()),
                    "signal_type": "portfolio_sale_announced",
                    "disposition_source": "listing",
                    "marketplace": marketplace,
                    "ticker": (row.get("ticker") or "").strip().upper(),
                    "cik": (row.get("cik") or "").strip(),
                    "originator_name": name,
                    "asset_class": (row.get("asset_class") or "").strip(),
                    "face_value_usd": (row.get("face_value_usd") or "").strip(),
                    "confidence": 0.95,  # operator-verified
                    "filed_at": filed_at,
                    "url": (row.get("url") or "").strip(),
                    "note": (row.get("note") or "").strip(),
                    "rationale": f"operator listing on {marketplace or 'marketplace'}",
                }
            )
    return out


def run() -> dict[str, Any]:
    banks = load_banks()
    news = storage.read_all("news_signals")

    news_events = classify_news_sales(news, banks)
    manual_events = load_manual_listings()
    all_events = news_events + manual_events

    written = storage.append(
        "dispositions", all_events, key_fields=("source", "source_id")
    )
    print(
        f"[dispositions] news={len(news_events)} listings={len(manual_events)} "
        f"new={written}"
    )
    return {
        "news_events": len(news_events),
        "listing_events": len(manual_events),
        "events_new": written,
        "snapshot_time": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(f"[dispositions] done: {run()}")
