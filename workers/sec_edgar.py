"""SEC EDGAR worker — pulls recent filings for seed banks and extracts NPL/divestiture signals.

Strategy (keep it boring; high signal-to-noise):
  1. Hit /submissions/CIK{cik}.json for each bank — gives every recent filing as structured JSON.
  2. Filter to 10-Q, 10-K, 8-K within the lookback window.
  3. Score each filing:
        - 8-K with item 2.01 (Completion of Acquisition or Disposition of Assets) -> high confidence
        - 8-K with item 2.06 (Material Impairments) -> high confidence
        - 8-K with item 7.01/8.01 mentioning loan/receivable/portfolio in title -> medium
        - 10-Q / 10-K -> recorded as a "review window" signal (parse later in v2)
  4. Write filings + signals to data/output/{filings,signals}.jsonl, deduped on accession number.
  5. Write a snapshot file for the Next.js dashboard to read.

Compliance:
  * All data sourced from data.sec.gov / www.sec.gov public APIs. No scraping, no consumer data.
  * SEC requires a User-Agent with contact info — see workers/tickers.py.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from workers import storage
from workers.tickers import SEC_UA, Bank, load_banks

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_RATE_LIMIT_SLEEP = 0.12  # ~8 req/sec, well under SEC's 10 req/sec cap

INTERESTING_FORMS = {"10-Q", "10-K", "8-K"}

# 8-K item codes with high signal for our purpose (deal sourcing).
# Reference: https://www.sec.gov/fast-answers/answersform8khtm.html
HIGH_CONFIDENCE_ITEMS = {
    "2.01",  # Completion of Acquisition or Disposition of Assets
    "2.06",  # Material Impairments
}
MEDIUM_CONFIDENCE_ITEMS = {
    "7.01",  # Reg FD Disclosure
    "8.01",  # Other Events
}

# Free-text keywords we expect to see in filing descriptions or item text when the
# event is actually about loan / receivable / portfolio activity.
PORTFOLIO_KEYWORDS = (
    "loan",
    "loans",
    "receivable",
    "receivables",
    "portfolio",
    "non-performing",
    "nonperforming",
    "charge-off",
    "charged-off",
    "charge off",
    "delinquent",
    "credit card",
    "auto",
    "mortgage",
    "consumer",
)


@dataclass
class Filing:
    cik: str
    accession: str
    form: str
    filed_at: str  # ISO date
    report_date: str
    primary_doc: str
    description: str
    items: tuple[str, ...]
    url: str


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": SEC_UA, "Accept": "application/json"})
    return s


def _accession_no_dashes(a: str) -> str:
    return a.replace("-", "")


def _filing_url(cik: str, accession: str, primary_doc: str) -> str:
    cik_int = str(int(cik))  # strip leading zeros for archive path
    return (
        "https://www.sec.gov/Archives/edgar/data/"
        f"{cik_int}/{_accession_no_dashes(accession)}/{primary_doc}"
    )


def fetch_recent_filings(
    bank: Bank, since: datetime, session: requests.Session | None = None
) -> list[Filing]:
    if not bank.cik:
        return []
    sess = session or _session()
    url = SUBMISSIONS_URL.format(cik=bank.cik)
    r = sess.get(url, timeout=30)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    data = r.json()
    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    filed_dates = recent.get("filingDate", [])
    report_dates = recent.get("reportDate", [])
    primary_docs = recent.get("primaryDocument", [])
    descriptions = recent.get("primaryDocDescription", [])
    items_field = recent.get("items", [])

    out: list[Filing] = []
    for i, form in enumerate(forms):
        if form not in INTERESTING_FORMS:
            continue
        try:
            filed_at = datetime.fromisoformat(filed_dates[i]).replace(tzinfo=timezone.utc)
        except (ValueError, IndexError):
            continue
        if filed_at < since:
            continue
        items_raw = items_field[i] if i < len(items_field) else ""
        items = tuple(s.strip() for s in items_raw.split(",") if s.strip())
        out.append(
            Filing(
                cik=bank.cik,
                accession=accessions[i],
                form=form,
                filed_at=filed_at.isoformat(),
                report_date=report_dates[i] if i < len(report_dates) else "",
                primary_doc=primary_docs[i] if i < len(primary_docs) else "",
                description=descriptions[i] if i < len(descriptions) else "",
                items=items,
                url=_filing_url(bank.cik, accessions[i], primary_docs[i] if i < len(primary_docs) else ""),
            )
        )
    return out


def _score_filing(filing: Filing) -> tuple[str, float, str] | None:
    """Return (signal_type, confidence, rationale) if filing is interesting."""
    desc_lower = filing.description.lower()

    if filing.form == "8-K":
        item_set = set(filing.items)
        if item_set & HIGH_CONFIDENCE_ITEMS:
            mentions = [k for k in PORTFOLIO_KEYWORDS if k in desc_lower]
            if "2.01" in item_set:
                stype = "portfolio_sale_announced" if mentions else "divestiture_announced"
                conf = 0.85 if mentions else 0.55
                return stype, conf, f"8-K item 2.01; doc desc keywords={mentions or 'none'}"
            if "2.06" in item_set:
                conf = 0.75 if mentions else 0.45
                return "reserve_build", conf, f"8-K item 2.06; doc desc keywords={mentions or 'none'}"
        if item_set & MEDIUM_CONFIDENCE_ITEMS:
            if any(k in desc_lower for k in PORTFOLIO_KEYWORDS):
                return "guidance_change", 0.45, f"8-K item {item_set}; description mentions portfolio terms"
        return None  # 8-K without high-signal items

    # 10-Q / 10-K — flag for review without parsing the document body in v1
    if filing.form in {"10-Q", "10-K"}:
        return "unspecified", 0.20, f"{filing.form} window; parse MD&A in v2"

    return None


def run(lookback_days: int = 120) -> dict[str, int]:
    since = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    banks = load_banks()
    sess = _session()

    all_filings: list[dict[str, Any]] = []
    all_signals: list[dict[str, Any]] = []

    print(f"[sec_edgar] scanning {len(banks)} banks since {since.date().isoformat()}")
    for bank in banks:
        if not bank.cik:
            print(f"[sec_edgar] skip {bank.ticker}: no CIK")
            continue
        try:
            filings = fetch_recent_filings(bank, since=since, session=sess)
        except requests.HTTPError as e:
            print(f"[sec_edgar] {bank.ticker} http error: {e}")
            time.sleep(SEC_RATE_LIMIT_SLEEP)
            continue
        for f in filings:
            all_filings.append(
                {
                    "source": "sec_edgar",
                    "source_id": f.accession,
                    "cik": f.cik,
                    "ticker": bank.ticker,
                    "originator_name": bank.name,
                    "tier": bank.tier,
                    "asset_class_focus": bank.asset_class_focus,
                    "form_type": f.form,
                    "filed_at": f.filed_at,
                    "period_of_report": f.report_date,
                    "url": f.url,
                    "description": f.description,
                    "items": list(f.items),
                }
            )
            score = _score_filing(f)
            if score is None:
                continue
            stype, conf, rationale = score
            all_signals.append(
                {
                    "source": "sec_edgar",
                    "source_id": f.accession,
                    "cik": f.cik,
                    "ticker": bank.ticker,
                    "originator_name": bank.name,
                    "tier": bank.tier,
                    "signal_type": stype,
                    "confidence": conf,
                    "filed_at": f.filed_at,
                    "form_type": f.form,
                    "items": list(f.items),
                    "url": f.url,
                    "excerpt": f.description,
                    "rationale": rationale,
                }
            )
        time.sleep(SEC_RATE_LIMIT_SLEEP)

    written_filings = storage.append("filings", all_filings, key_fields=("source", "source_id"))
    written_signals = storage.append("signals", all_signals, key_fields=("source", "source_id"))

    return {
        "filings_seen": len(all_filings),
        "filings_new": written_filings,
        "signals_seen": len(all_signals),
        "signals_new": written_signals,
    }


if __name__ == "__main__":
    summary = run()
    print(f"[sec_edgar] done: {summary}")
