"""News-to-originator matching.

Joins free-text news headlines to the seed bank list so the radar can show
"FITB · 4 SEC filings + 2 news mentions" instead of two unconnected streams.

Approach: for each bank we generate a small set of safe aliases (no false-
positive single tokens like "key" or "c"); match news (title + summary) by
case-insensitive substring; attach matched tickers back to each news row.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

from workers.tickers import Bank

# Banks whose aliases need explicit overrides because the canonical name is
# ambiguous, has a common short form, or includes special characters.
EXPLICIT_ALIASES: dict[str, tuple[str, ...]] = {
    "JPM":  ("jpmorgan", "jp morgan", "jpmorgan chase", "chase bank"),
    "BAC":  ("bank of america", "bofa", "merrill lynch"),
    "C":    ("citigroup", "citibank"),                        # avoid "citi" alone
    "WFC":  ("wells fargo",),
    "GS":   ("goldman sachs",),                                # avoid "goldman" alone
    "MS":   ("morgan stanley",),
    "USB":  ("us bancorp", "u.s. bancorp", "us bank", "u.s. bank"),
    "PNC":  ("pnc financial", "pnc bank"),
    "TFC":  ("truist",),
    "COF":  ("capital one",),
    "DFS":  ("discover financial", "discover card"),
    "SYF":  ("synchrony financial", "synchrony bank"),
    "ALLY": ("ally financial", "ally bank"),
    "CFG":  ("citizens financial", "citizens bank"),
    "KEY":  ("keycorp", "key bank"),
    "FITB": ("fifth third",),
    "RF":   ("regions financial", "regions bank"),
    "MTB":  ("m&t bank", "m & t bank"),
    "HBAN": ("huntington bancshares", "huntington bank"),
    "NTRS": ("northern trust",),
    "BK":   ("bny mellon", "bank of new york mellon"),
    "STT":  ("state street",),
    "CMA":  ("comerica",),
    "ZION": ("zions bancorp", "zions bank"),
    "FHN":  ("first horizon",),
    "WAL":  ("western alliance",),
    "WBS":  ("webster financial", "webster bank"),
    "FLG":  ("flagstar", "nycb", "new york community bancorp"),
    "EWBC": ("east west bancorp", "east west bank"),
    "SNV":  ("synovus",),
    "PB":   ("prosperity bancshares", "prosperity bank"),
}

# Tokens too common to be safe by themselves.
_STOP_TOKENS = {"inc", "inc.", "corp", "corp.", "corporation", "group", "co", "co.", "bank", "company"}


def _name_alias(name: str) -> str:
    """Reduce a legal name to a normalized alias: lowercase, drop suffixes."""
    parts = re.split(r"[\s.,]+", name.lower())
    kept = [p for p in parts if p and p not in _STOP_TOKENS]
    return " ".join(kept).strip()


def aliases_for(bank: Bank) -> tuple[str, ...]:
    explicit = EXPLICIT_ALIASES.get(bank.ticker, ())
    name_alias = _name_alias(bank.name)
    out = list(explicit)
    if name_alias and name_alias not in out:
        out.append(name_alias)
    return tuple(out)


def match_news(
    news: Iterable[dict[str, Any]], banks: Iterable[Bank]
) -> list[dict[str, Any]]:
    """Return news rows with `matched_tickers` set to all banks the headline
    or summary mentions."""
    bank_alias_pairs: list[tuple[str, tuple[str, ...]]] = [
        (b.ticker, aliases_for(b)) for b in banks
    ]
    out: list[dict[str, Any]] = []
    for n in news:
        text = f"{n.get('title') or ''} {n.get('summary') or ''}".lower()
        matched: list[str] = []
        for ticker, aliases in bank_alias_pairs:
            for a in aliases:
                if a and a in text:
                    matched.append(ticker)
                    break
        copy = dict(n)
        copy["matched_tickers"] = sorted(set(matched))
        out.append(copy)
    return out


def news_by_ticker(matched_news: Iterable[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    by: dict[str, list[dict[str, Any]]] = {}
    for n in matched_news:
        for t in n.get("matched_tickers", []) or []:
            by.setdefault(t, []).append(n)
    for t in by:
        by[t].sort(key=lambda r: r.get("published_at", ""), reverse=True)
    return by


if __name__ == "__main__":
    from workers import storage
    from workers.tickers import load_banks

    banks = load_banks()
    news = storage.read_all("news_signals")
    matched = match_news(news, banks)
    by = news_by_ticker(matched)
    n_with_match = sum(1 for r in matched if r.get("matched_tickers"))
    print(f"matched {n_with_match} / {len(matched)} news items to seed banks")
    for ticker in sorted(by, key=lambda t: -len(by[t])):
        print(f"  {ticker:6}  {len(by[ticker])} mentions")
