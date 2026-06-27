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
import re
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree as ET

import requests

from workers.tickers import SEC_UA

ROOT = Path(__file__).resolve().parent.parent
BUYERS_CSV = ROOT / "data" / "seed" / "buyers.csv"
COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"

PAR_CONCEPT = "FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue"
PRICE_CONCEPT = "FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice"

XBRLI = "http://www.xbrl.org/2003/instance"
XBRLDI = "http://xbrl.org/2006/xbrldi"
SEC_SLEEP = 0.15

# The frames API lists every filer reporting a concept in a calendar period — we
# use it to AUTO-DISCOVER public buyers that tag PCD purchases, so the index
# grows on its own as new buyers go public, without editing a seed list.
FRAMES_URL = "https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/USD/{frame}.json"
DISCOVERY_FRAMES = (
    "CY2024Q4I", "CY2025Q1I", "CY2025Q2I", "CY2025Q3I", "CY2025Q4I", "CY2026Q1I",
)
# Purchase price ÷ par above this is a near-par loan acquisition (bank M&A),
# NOT charged-off debt. The discount itself defines the charged-off-debt index:
# Encore/PRA buy at ~12¢; banks acquiring loan books pay 50–110¢. This filter
# keeps the index clean and is self-maintaining.
DISTRESSED_MAX_CENTS = 40.0

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


def _clean_segment(member: str) -> str:
    """'CorePortfolioSegmentMember' -> 'Core'; humanize anything else."""
    name = re.sub(r"(PortfolioSegment)?Member$", "", member)
    name = re.sub(r"PortfolioSegment$", "", name)
    # Split camelCase into words.
    words = re.sub(r"(?<!^)(?=[A-Z])", " ", name).strip()
    return words or member


def extract_segments(instance_xml: str) -> list[dict[str, Any]]:
    """Per-segment cents-on-the-dollar from a raw XBRL instance. Pure —
    unit-testable. Returns [] when the filer tags only consolidated totals.

    Reads the by-segment members the convenience `companyfacts` API flattens
    away — e.g. PRA's Core vs Insolvency purchase pools.
    """
    try:
        root = ET.fromstring(instance_xml)
    except ET.ParseError:
        return []

    # context id -> (segment member or None, period_end, dimension_count)
    ctx: dict[str, tuple[str | None, str | None, int]] = {}
    for c in root.findall(f"{{{XBRLI}}}context"):
        members = [
            (m.get("dimension", "").split(":")[-1], (m.text or "").split(":")[-1])
            for m in c.iter(f"{{{XBRLDI}}}explicitMember")
        ]
        seg = next((mem for dim, mem in members if "Segment" in dim), None)
        period = c.find(f"{{{XBRLI}}}period")
        end = None
        if period is not None:
            e = period.find(f"{{{XBRLI}}}endDate")
            i = period.find(f"{{{XBRLI}}}instant")
            end = e.text if e is not None else (i.text if i is not None else None)
        ctx[c.get("id")] = (seg, end, len(members))

    def facts(concept: str) -> list[tuple[str | None, str | None, int, float]]:
        out = []
        for e in root.iter():
            if e.tag.endswith("}" + concept):
                seg, end, ndim = ctx.get(e.get("contextRef"), (None, None, 0))
                try:
                    out.append((seg, end, ndim, float(e.text)))
                except (TypeError, ValueError):
                    continue
        return out

    price, par = facts(PRICE_CONCEPT), facts(PAR_CONCEPT)
    price_ends = [end for _, end, _, _ in price if end]
    if not price_ends:
        return []
    latest = max(price_ends)

    def by_member(rows):  # single-dimension facts for the latest period
        d: dict[str, float] = {}
        for seg, end, ndim, val in rows:
            if end == latest and ndim == 1 and seg:
                d[seg] = val
        return d

    pm, rm = by_member(price), by_member(par)
    segs = [
        {
            "segment": _clean_segment(m),
            "cents": round(pm[m] / rm[m] * 100, 2),
            "par": rm[m],
            "price": pm[m],
        }
        for m in pm
        if m in rm and rm[m] > 0
    ]
    segs.sort(key=lambda s: -s["par"])
    return segs


def _latest_instance_url(cik: str, sess: requests.Session) -> str | None:
    """URL of the latest 10-Q/10-K XBRL instance document for a filer."""
    try:
        sub = sess.get(SUBMISSIONS_URL.format(cik=cik), timeout=60).json()
    except (requests.RequestException, ValueError):
        return None
    r = sub.get("filings", {}).get("recent", {})
    forms = r.get("form", [])
    for i, form in enumerate(forms):
        if form not in ("10-Q", "10-K"):
            continue
        acc = r["accessionNumber"][i].replace("-", "")
        base = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}"
        try:
            idx = sess.get(f"{base}/index.json", timeout=60).json()
        except (requests.RequestException, ValueError):
            return None
        for item in idx.get("directory", {}).get("item", []):
            name = item.get("name", "")
            if name.endswith("_htm.xml"):
                return f"{base}/{name}"
        return None
    return None


def fetch_segments(cik: str, sess: requests.Session) -> list[dict[str, Any]]:
    """Per-segment purchase multiples from the latest filing instance. Empty on
    any failure or when the filer doesn't tag segments."""
    url = _latest_instance_url(cik, sess)
    if not url:
        return []
    time.sleep(SEC_SLEEP)
    try:
        r = sess.get(url, timeout=90)
        r.raise_for_status()
    except requests.RequestException:
        return []
    return extract_segments(r.text)


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
    # Asset-class / portfolio-segment breakdown from the raw filing instance
    # (companyfacts flattens it). Empty for filers that tag consolidated only.
    segments = fetch_segments(buyer["cik"], sess)
    return {
        "ticker": buyer["ticker"],
        "name": buyer["name"],
        **pricing,
        "segments": segments,
    }


def _median(vals: list[float]) -> float | None:
    if not vals:
        return None
    s = sorted(vals)
    n = len(s)
    return s[n // 2] if n % 2 else round((s[n // 2 - 1] + s[n // 2]) / 2, 2)


def discover_panel(sess: requests.Session) -> dict[str, str]:
    """The seed buyers + every filer the frames API shows tagging PCD purchases.
    Returns {cik(10-digit): entityName}. Future buyers join automatically."""
    panel: dict[str, str] = {}
    for b in load_buyers():
        panel[b["cik"]] = b["name"]
    for concept in (PRICE_CONCEPT, PAR_CONCEPT):
        for frame in DISCOVERY_FRAMES:
            try:
                r = sess.get(FRAMES_URL.format(concept=concept, frame=frame), timeout=40)
            except requests.RequestException:
                continue
            if r.status_code != 200:
                continue
            try:
                data = r.json().get("data", [])
            except ValueError:
                continue
            for d in data:
                cik = str(d.get("cik", "")).zfill(10)
                if cik.strip("0"):
                    panel.setdefault(cik, str(d.get("entityName", "")).strip())
            time.sleep(SEC_SLEEP)
    return panel


def compute_index(buyers: list[dict[str, Any]], quarters: int = 8) -> list[dict[str, Any]]:
    """The market index: median cents-on-the-dollar across the distressed panel
    per quarter, from each buyer's blended-multiple series. Pure — testable."""
    by_end: dict[str, list[float]] = {}
    for b in buyers:
        for pt in b.get("series", []):
            by_end.setdefault(pt["end"], []).append(pt["cents"])
    out = []
    for end in sorted(by_end):
        vals = sorted(by_end[end])
        out.append(
            {
                "end": end,
                "median_cents": _median(vals),
                "n": len(vals),
                "low": vals[0],
                "high": vals[-1],
            }
        )
    return out[-quarters:]


def run() -> dict[str, Any]:
    from workers import storage

    sess = _session()
    seed_ticker = {b["cik"]: b["ticker"] for b in load_buyers()}
    panel = discover_panel(sess)

    distressed: list[dict[str, Any]] = []
    near_par = 0
    for cik, name in panel.items():
        rec = fetch_buyer({"ticker": seed_ticker.get(cik, ""), "name": name, "cik": cik}, sess)
        if not rec:
            continue
        if rec["latest_cents"] <= DISTRESSED_MAX_CENTS:
            distressed.append(rec)
        else:
            near_par += 1  # loan acquisition / M&A — excluded from the index

    distressed.sort(key=lambda r: r["as_of"], reverse=True)
    index = compute_index(distressed)

    # Headline from the latest index point; direction over ~4 quarters.
    market_median = index[-1]["median_cents"] if index else None
    direction = "mixed"
    if len(index) >= 5 and index[-1]["median_cents"] is not None and index[-5]["median_cents"] is not None:
        delta = index[-1]["median_cents"] - index[-5]["median_cents"]
        direction = "rising" if delta > 0.3 else "softening" if delta < -0.3 else "flat"
    elif distressed:
        rising = sum(1 for r in distressed if r["trend"] == "rising")
        direction = "rising" if rising > len(distressed) / 2 else "softening" if rising == 0 else "mixed"

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "market_median_cents": market_median,
        "price_direction": direction,
        "buyers": distressed,
        "index": index,
        "panel_size": len(distressed),
        "near_par_excluded": near_par,
    }
    storage.write_snapshot("market_pricing", payload)
    print(
        f"[buyers] panel={len(distressed)} distressed (+{near_par} near-par excluded); "
        f"index median {market_median}¢; direction {direction}"
    )
    return {
        "panel_size": len(distressed),
        "near_par_excluded": near_par,
        "index_quarters": len(index),
        "market_median_cents": market_median,
        "price_direction": direction,
    }


if __name__ == "__main__":
    print(f"[buyers] done: {run()}")
