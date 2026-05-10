"""Resolve tickers in data/seed/banks.csv to SEC CIKs via the public mapping file."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "data" / "seed" / "banks.csv"
AUTO_SEED = ROOT / "data" / "seed" / "banks_auto.csv"
CACHE = ROOT / "data" / "output" / "company_tickers.json"

# SEC asks for a contact in the User-Agent. Keep this honest and reachable.
SEC_UA = "Tradeline workers kwanusmrket@gmail.com"

COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

# Fallback CIKs for tickers SEC's public ticker file omits (verified 2026-05-06
# via /submissions/CIK{cik}.json round-trip). Edit if you find the public file
# starts shipping these — overrides win when a ticker appears in both.
TICKER_CIK_OVERRIDES: dict[str, str] = {
    "DFS": "0001393612",   # Discover Financial Services (acquired by COF 2025-05; historical filings preserved)
    "CMA": "0000028412",   # Comerica
    "SNV": "0000018349",   # Synovus Financial
}


@dataclass(frozen=True)
class Bank:
    ticker: str
    name: str
    tier: str
    asset_class_focus: str
    note: str
    cik: str | None  # 10-digit zero-padded


def _fetch_company_tickers(force: bool = False) -> dict:
    if CACHE.exists() and not force:
        try:
            return json.loads(CACHE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(COMPANY_TICKERS_URL, headers={"User-Agent": SEC_UA}, timeout=30)
    r.raise_for_status()
    data = r.json()
    CACHE.write_text(json.dumps(data), encoding="utf-8")
    return data


def _ticker_to_cik(mapping: dict) -> dict[str, str]:
    """SEC ships a dict keyed by index, each row has cik_str and ticker."""
    out: dict[str, str] = {}
    for row in mapping.values():
        ticker = str(row.get("ticker", "")).upper().strip()
        cik = str(row.get("cik_str", "")).strip()
        if ticker and cik:
            out[ticker] = cik.zfill(10)
    return out


def load_banks(force_refresh: bool = False) -> list[Bank]:
    if not SEED.exists():
        raise FileNotFoundError(f"missing seed file: {SEED}")
    tickers_map = _ticker_to_cik(_fetch_company_tickers(force=force_refresh))
    banks: list[Bank] = []
    seen: set[str] = set()

    def _ingest(path: Path) -> None:
        if not path.exists():
            return
        with path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticker = (row.get("ticker") or "").strip().upper()
                if not ticker or ticker in seen:
                    continue
                seen.add(ticker)
                cik = tickers_map.get(ticker) or TICKER_CIK_OVERRIDES.get(ticker)
                banks.append(
                    Bank(
                        ticker=ticker,
                        name=(row.get("name") or "").strip(),
                        tier=(row.get("tier") or "").strip(),
                        asset_class_focus=(row.get("asset_class_focus") or "").strip(),
                        note=(row.get("note") or "").strip(),
                        cik=cik,
                    )
                )

    _ingest(SEED)        # human-curated first (wins ticker uniqueness)
    _ingest(AUTO_SEED)   # then auto-discovered
    return banks


if __name__ == "__main__":
    for b in load_banks():
        print(f"{b.ticker:6}  cik={b.cik or '   none   '}  {b.tier:16}  {b.name}")
