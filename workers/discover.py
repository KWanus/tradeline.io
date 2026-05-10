"""Discover new banks worth tracking by scanning SEC EDGAR's live 8-K feed.

Strategy:
  1. Pull SEC's "recent filings" RSS feed for 8-Ks (last 100, refreshed continuously).
  2. For each filing we don't already track:
     a. Fetch the company's submissions JSON to get SIC code + name.
     b. Skip if SIC code isn't a bank/lender/finance company.
     c. Skip if the 8-K items don't include any of our high-signal codes.
     d. Skip if the filing text/description doesn't match NPL keywords.
  3. Score the candidate:
     - 0.9: 8-K with item 2.01 (disposition) + NPL keywords  -> auto-promote
     - 0.7: 8-K with item 2.06 (material impairment) + NPL keywords -> auto-promote
     - 0.5: 8-K with item 8.01 (other events) + NPL keywords -> pending review
  4. Append to data/output/candidates.json (dedupe by accession number).
  5. Auto-promote candidates with score >= 0.7 to data/seed/banks_auto.csv.

The radar's next run picks up auto-promoted tickers and starts tracking them like
any human-curated bank.

Outcomes handled:
  - new high-signal filing from an untracked bank -> auto-promoted
  - new medium-signal filing -> pending in candidates.json
  - duplicate filings (same accession) -> deduped
  - filing from already-tracked bank -> ignored (the main worker handles those)
  - non-bank SIC code -> ignored
  - 8-K without relevant items -> ignored
  - network failure on a single filing -> logged, scan continues
  - empty discovery run -> writes empty arrays, doesn't break radar
  - bank later flagged as merged/failed -> kept with metadata, not removed

Compliance:
  - Uses only public SEC EDGAR endpoints with the standard contact UA.
  - No consumer data touched.
"""

from __future__ import annotations

import csv
import json
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import requests

from workers.tickers import SEC_UA

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "seed" / "banks.csv"
AUTO_SEED = ROOT / "data" / "seed" / "banks_auto.csv"
CANDIDATES = ROOT / "data" / "output" / "candidates.json"

# SEC's "recent filings" Atom feed — last ~40 of any type. We query 8-K only.
RECENT_8K_FEED = (
    "https://www.sec.gov/cgi-bin/browse-edgar"
    "?action=getcurrent&type=8-K&owner=include&count=100&output=atom"
)
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_RATE_LIMIT_SLEEP = 0.12  # well under SEC's 10 req/sec cap

# SIC codes for banks, lenders, and finance companies that originate consumer
# debt. We include holding companies because that's how most banks file.
BANK_SIC_CODES = {
    "6020",  # State Commercial Banks
    "6021",  # National Commercial Banks
    "6022",  # State Commercial Banks
    "6029",  # Commercial Banks NEC
    "6035",  # Savings Institutions, Federal
    "6036",  # Savings Institutions, State
    "6099",  # Functions related to depository banking
    "6141",  # Personal Credit Institutions (think OneMain, World Acceptance)
    "6159",  # Federal and federally sponsored credit agencies
    "6162",  # Mortgage Bankers and Loan Correspondents
    "6172",  # Finance Services NEC
    "6189",  # Asset-Backed Securities
    "6199",  # Finance Services
    "6712",  # Offices of Bank Holding Companies
}

# 8-K items relevant to NPL events.
HIGH_SIGNAL_ITEMS = {"2.01", "2.06"}  # disposition / material impairment
MEDIUM_SIGNAL_ITEMS = {"7.01", "8.01"}  # FD disclosure / other events

# Keywords in filing descriptions that suggest NPL relevance.
NPL_KEYWORDS = re.compile(
    r"charge[\- ]?off|non[\- ]?performing|portfolio sale|portfolio disposition|"
    r"divest|allowance for credit losses|loan loss|credit loss provision|"
    r"discontinued operations|loan portfolio|receivable portfolio|"
    r"npl|defaulted loans|delinquen",
    re.IGNORECASE,
)


@dataclass
class Candidate:
    ticker: str | None
    cik: str
    name: str
    sic: str
    accession: str
    form_type: str
    items: list[str]
    filed_at: str
    description: str
    url: str
    confidence: float
    discovered_at: str
    auto_promoted: bool = False
    promoted_at: str | None = None


def _ua() -> dict[str, str]:
    return {"User-Agent": SEC_UA, "Accept": "application/json, application/atom+xml"}


def _existing_tickers() -> set[str]:
    """Tickers we already track (manual seed + previously auto-promoted)."""
    tickers: set[str] = set()
    for path in (SEED, AUTO_SEED):
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = (row.get("ticker") or "").strip().upper()
                if t:
                    tickers.add(t)
    return tickers


def _read_candidates() -> list[Candidate]:
    if not CANDIDATES.exists():
        return []
    try:
        raw = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    out: list[Candidate] = []
    for row in raw if isinstance(raw, list) else []:
        try:
            out.append(Candidate(**row))
        except TypeError:
            continue
    return out


def _write_candidates(candidates: list[Candidate]) -> None:
    CANDIDATES.parent.mkdir(parents=True, exist_ok=True)
    tmp = CANDIDATES.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps([asdict(c) for c in candidates], indent=2),
        encoding="utf-8",
    )
    tmp.replace(CANDIDATES)


def _write_auto_seed(candidates: list[Candidate]) -> None:
    """Write banks_auto.csv with the same shape as banks.csv."""
    AUTO_SEED.parent.mkdir(parents=True, exist_ok=True)
    promoted = [c for c in candidates if c.auto_promoted and c.ticker]
    # Dedupe by ticker, keeping highest-confidence row.
    by_ticker: dict[str, Candidate] = {}
    for c in promoted:
        t = (c.ticker or "").upper()
        if not t:
            continue
        if t not in by_ticker or c.confidence > by_ticker[t].confidence:
            by_ticker[t] = c
    with AUTO_SEED.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ticker", "name", "tier", "asset_class_focus", "note"])
        for c in sorted(by_ticker.values(), key=lambda x: x.ticker or ""):
            w.writerow(
                [
                    c.ticker,
                    c.name,
                    "auto",
                    _infer_asset_class(c.name),
                    f"auto-discovered {c.promoted_at or c.discovered_at} via {c.form_type} item {','.join(c.items)}",
                ]
            )


def _infer_asset_class(name: str) -> str:
    n = (name or "").lower()
    if any(k in n for k in ("mortgage", "residential", "home loans")):
        return "mortgage"
    if any(k in n for k in ("auto", "vehicle", "drive")):
        return "auto"
    if any(k in n for k in ("medical", "health")):
        return "medical"
    if any(k in n for k in ("card", "consumer credit")):
        return "credit-card"
    if any(k in n for k in ("finance", "credit", "loan")):
        return "consumer"
    return "multi"


def fetch_recent_8ks() -> list[dict[str, str]]:
    """Pull the Atom feed of recent 8-K filings. Returns a list of entry dicts."""
    r = requests.get(RECENT_8K_FEED, headers=_ua(), timeout=30)
    r.raise_for_status()
    return _parse_atom_8ks(r.text)


def _parse_atom_8ks(xml_text: str) -> list[dict[str, str]]:
    """Parse SEC's Atom feed into entries with cik, accession, filed_at, items, url."""
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out: list[dict[str, str]] = []
    root = ET.fromstring(xml_text)
    for entry in root.findall("a:entry", ns):
        title = (entry.findtext("a:title", default="", namespaces=ns) or "").strip()
        summary = (entry.findtext("a:summary", default="", namespaces=ns) or "").strip()
        updated = (entry.findtext("a:updated", default="", namespaces=ns) or "").strip()
        link_el = entry.find("a:link", ns)
        url = link_el.attrib.get("href", "") if link_el is not None else ""

        # Parse CIK from URL (path includes /CIK#######/).
        m = re.search(r"/data/(\d+)/(\d{10}-\d{2}-\d{6})", url)
        cik = m.group(1).zfill(10) if m else ""
        accession = m.group(2) if m else ""

        # Items live in summary like "Items 2.01, 8.01" — be liberal.
        item_codes = re.findall(r"\b(\d\.\d{2})\b", summary + " " + title)
        items = sorted(set(item_codes))

        out.append(
            {
                "cik": cik,
                "accession": accession,
                "filed_at": updated,
                "url": url,
                "title": title,
                "summary": summary,
                "items": ",".join(items),
            }
        )
    return out


def fetch_submission(cik: str) -> dict[str, Any] | None:
    """Get a company's submissions JSON (gives SIC code, name, tickers)."""
    if not cik:
        return None
    try:
        time.sleep(SEC_RATE_LIMIT_SLEEP)
        r = requests.get(SUBMISSIONS_URL.format(cik=cik), headers=_ua(), timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[discover] submissions fetch failed for CIK {cik}: {e}")
        return None


def _score(items: list[str], description: str) -> float:
    has_high = bool(set(items) & HIGH_SIGNAL_ITEMS)
    has_medium = bool(set(items) & MEDIUM_SIGNAL_ITEMS)
    has_keywords = bool(NPL_KEYWORDS.search(description or ""))

    if has_high and has_keywords:
        return 0.9
    if has_high:
        return 0.6  # high item but no keyword match — could be M&A unrelated to NPL
    if has_medium and has_keywords:
        return 0.5
    return 0.0


def run() -> dict[str, Any]:
    """Main entry. Scans recent 8-Ks, updates candidates.json, rewrites banks_auto.csv."""
    existing = _existing_tickers()
    existing_candidates = _read_candidates()
    seen_accessions = {c.accession for c in existing_candidates}

    try:
        entries = fetch_recent_8ks()
    except Exception as e:
        print(f"[discover] feed fetch failed: {e}")
        return {"scanned": 0, "new_candidates": 0, "auto_promoted": 0, "error": str(e)}

    new_candidates: list[Candidate] = []
    for entry in entries:
        if not entry["cik"] or not entry["accession"]:
            continue
        if entry["accession"] in seen_accessions:
            continue
        items = [i for i in entry["items"].split(",") if i]
        # Quick reject: only proceed if items include a relevant code
        if not (set(items) & (HIGH_SIGNAL_ITEMS | MEDIUM_SIGNAL_ITEMS)):
            continue

        sub = fetch_submission(entry["cik"])
        if not sub:
            continue
        sic = str(sub.get("sicCode") or sub.get("sic") or "").strip()
        if sic not in BANK_SIC_CODES:
            continue

        # Resolve ticker from the submissions blob (preferred) or skip.
        tickers = sub.get("tickers") or []
        ticker = (tickers[0] if tickers else "").upper() or None
        if ticker and ticker in existing:
            continue  # already tracked

        name = sub.get("name") or entry["title"]
        description = entry["summary"] or entry["title"]
        score = _score(items, description)
        if score < 0.5:
            continue

        now = datetime.now(timezone.utc).isoformat()
        candidate = Candidate(
            ticker=ticker,
            cik=entry["cik"],
            name=name,
            sic=sic,
            accession=entry["accession"],
            form_type="8-K",
            items=items,
            filed_at=entry["filed_at"],
            description=description[:500],
            url=entry["url"],
            confidence=score,
            discovered_at=now,
            auto_promoted=score >= 0.7 and ticker is not None,
            promoted_at=now if (score >= 0.7 and ticker is not None) else None,
        )
        new_candidates.append(candidate)
        seen_accessions.add(entry["accession"])

    merged = existing_candidates + new_candidates
    # Keep candidates.json bounded — cap to last 500 by discovered_at.
    merged.sort(key=lambda c: c.discovered_at, reverse=True)
    merged = merged[:500]

    _write_candidates(merged)
    _write_auto_seed(merged)

    auto_promoted = sum(1 for c in new_candidates if c.auto_promoted)
    print(
        f"[discover] scanned={len(entries)} new_candidates={len(new_candidates)} "
        f"auto_promoted={auto_promoted} candidates_total={len(merged)}"
    )
    return {
        "scanned": len(entries),
        "new_candidates": len(new_candidates),
        "auto_promoted": auto_promoted,
        "candidates_total": len(merged),
    }


if __name__ == "__main__":
    raise SystemExit(0 if run().get("error") is None else 1)
