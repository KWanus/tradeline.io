"""Buyer-side market pricing — "who bought, at what price" from public data.

The marketplaces gate the transaction record. But the big debt BUYERS are
public companies, and they disclose what they pay. Under PCD (purchased credit
deteriorated) accounting, they XBRL-tag both the face value and the purchase
price of the receivables they hold:

  FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue      (face)
  FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice (paid)

purchase_price / par = cents on the dollar — the market clearing price for
charged-off paper. We track it per buyer and as a market blend, with the
quarter-over-quarter trend (rising = market heating, buyers paying up).

This is the public answer to "at what price": no partner feed, no scraping,
just the buyers' own SEC filings via the XBRL companyfacts API.

Output: data/output/market_pricing.json (embedded into the radar snapshot as
`market_pricing`).
"""

from __future__ import annotations

import csv
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

import requests

from workers.tickers import SEC_UA

ROOT = Path(__file__).resolve().parent.parent
BUYERS_CSV = ROOT / "data" / "seed" / "buyers.csv"
COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

PAR_CONCEPT = "FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue"
PRICE_CONCEPT = "FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice"

# Quarters of history to keep for the trend sparkline.
SERIES_QUARTERS = 8


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": SEC_UA, "Accept": "application/json"})
    return s


def load_buyers(path: Path = BUYERS_CSV) -> list[dict[str, str]]:
    if not path.exists():
        return []
    out: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cik = (row.get("cik") or "").strip()
            if not cik:
                continue
            out.append(
                {
                    "ticker": (row.get("ticker") or "").strip().upper(),
                    "name": (row.get("name") or "").strip(),
                    "cik": cik.zfill(10),
                }
            )
    return out


def _series_by_end(concept: dict[str, Any]) -> dict[str, float]:
    """Latest value per period-end for a us-gaap concept (USD units)."""
    out: dict[str, float] = {}
    units = (concept or {}).get("units", {})
    rows = units.get("USD", [])
    for r in rows:
        end = r.get("end")
        val = r.get("val")
        if end is None or val is None:
            continue
        # Same period can appear in multiple filings; later filing wins.
        out[str(end)] = float(val)
    return out


def compute_pricing(
    par_by_end: dict[str, float], price_by_end: dict[str, float]
) -> dict[str, Any] | None:
    """Cents-on-the-dollar series + latest/trend. Pure — unit-testable."""
    ends = sorted(e for e in par_by_end if e in price_by_end and par_by_end[e] > 0)
    if not ends:
        return None
    series = [
        {"end": e, "cents": round(price_by_end[e] / par_by_end[e] * 100, 2)}
        for e in ends
    ][-SERIES_QUARTERS:]
    latest = series[-1]
    # YoY: compare to the point ~1 year (4 quarters) earlier if present.
    yoy_change = None
    if len(series) >= 5:
        yoy_change = round(latest["cents"] - series[-5]["cents"], 2)
    elif len(series) >= 2:
        yoy_change = round(latest["cents"] - series[0]["cents"], 2)
    trend = (
        "rising" if (yoy_change or 0) > 0.3
        else "falling" if (yoy_change or 0) < -0.3
        else "flat"
    )
    return {
        "latest_cents": latest["cents"],
        "as_of": latest["end"],
        "yoy_change": yoy_change,
        "trend": trend,
        "par_value": par_by_end[latest["end"]],
        "purchase_price": price_by_end[latest["end"]],
        "series": series,
    }


def fetch_buyer(buyer: dict[str, str], sess: requests.Session) -> dict[str, Any] | None:
    try:
        r = sess.get(COMPANYFACTS_URL.format(cik=buyer["cik"]), timeout=60)
        r.raise_for_status()
        facts = r.json().get("facts", {}).get("us-gaap", {})
    except (requests.RequestException, ValueError) as e:
        print(f"[buyers] {buyer['ticker']}: fetch failed ({e})")
        return None
    pricing = compute_pricing(
        _series_by_end(facts.get(PAR_CONCEPT, {})),
        _series_by_end(facts.get(PRICE_CONCEPT, {})),
    )
    if not pricing:
        print(f"[buyers] {buyer['ticker']}: no PCD purchase concepts tagged")
        return None
    return {"ticker": buyer["ticker"], "name": buyer["name"], **pricing}


def _median(vals: list[float]) -> float | None:
    if not vals:
        return None
    s = sorted(vals)
    n = len(s)
    return s[n // 2] if n % 2 else round((s[n // 2 - 1] + s[n // 2]) / 2, 2)


def run() -> dict[str, Any]:
    from workers import storage

    buyers = load_buyers()
    sess = _session()
    rows: list[dict[str, Any]] = []
    for b in buyers:
        rec = fetch_buyer(b, sess)
        if rec:
            rows.append(rec)

    rows.sort(key=lambda r: r["as_of"], reverse=True)
    market_median = _median([r["latest_cents"] for r in rows])
    rising = sum(1 for r in rows if r["trend"] == "rising")
    direction = (
        "rising" if rising > len(rows) / 2
        else "softening" if rising == 0 and rows
        else "mixed"
    )
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "market_median_cents": market_median,
        "price_direction": direction,
        "buyers": rows,
    }
    storage.write_snapshot("market_pricing", payload)
    print(
        f"[buyers] {len(rows)} buyers; market median {market_median} cents/$; "
        f"direction {direction}"
    )
    return {
        "buyers": len(rows),
        "market_median_cents": market_median,
        "price_direction": direction,
    }


if __name__ == "__main__":
    print(f"[buyers] done: {run()}")
