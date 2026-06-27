"""Macro worker — national consumer-credit stress + per-state unemployment.

Per-originator signals (SEC, FDIC, NCUA) tell you *which* institution is under
stress. This worker adds the backdrop: is consumer credit deteriorating
nationally (more supply coming), and how stressed is each state's economy
(geographic risk for the local-seller radar)?

Sources — both keyless public Federal Reserve (FRED) CSV endpoints:
  * National consumer-credit series (delinquency / charge-off rates).
  * Per-state unemployment ({ST}UR). FRED redistributes BLS's LAUS series, so
    we get the BLS geographic data without BLS's API-key gating.

Compliance: public aggregate macro data. No consumer or institution PII.

Output: data/output/macro.json (embedded into the radar snapshot as `macro`).
"""

from __future__ import annotations

import csv
import io
import time
from datetime import datetime, timezone
from typing import Any

import requests

FREDGRAPH_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
HTTP_UA = "Tradeline radar (workers/macro.py; hello@tradeline.io)"
HTTP_TIMEOUT = 60
HTTP_SLEEP = 0.15

# National consumer-credit stress series (key -> (FRED id, label, higher_is_worse)).
NATIONAL_SERIES: tuple[tuple[str, str, str], ...] = (
    ("cc_delinquency", "DRCCLACBS", "Credit-card delinquency rate"),
    ("cc_chargeoff", "CORCCACBS", "Credit-card charge-off rate"),
    ("consumer_delinquency", "DRCLACBS", "Consumer-loan delinquency rate"),
    ("all_loan_chargeoff", "CORALACBS", "All-loan charge-off rate"),
)

# 50 states + DC. FRED unemployment-rate series id is "{ST}UR" (e.g. VAUR, DCUR).
STATES: tuple[str, ...] = (
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
    "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
    "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
    "WV", "WI", "WY",
)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": HTTP_UA})
    return s


def parse_fred_csv(text: str) -> list[tuple[str, float]]:
    """Parse a fredgraph CSV into [(date, value)], dropping missing ('.') points.

    FRED's first column is the date; the second is the series value. Pure — no
    I/O — so the stat logic is unit-testable without the network.
    """
    out: list[tuple[str, float]] = []
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    for row in rows[1:]:  # skip header
        if len(row) < 2:
            continue
        date, raw = row[0].strip(), row[-1].strip()
        if not date or raw in ("", "."):
            continue
        try:
            out.append((date, float(raw)))
        except ValueError:
            continue
    return out


def _yoy(points: list[tuple[str, float]]) -> float | None:
    """Change vs. ~12 months earlier. Works for monthly and quarterly series by
    stepping back by date, not by index."""
    if len(points) < 2:
        return None
    latest_date, latest_val = points[-1]
    target_year = str(int(latest_date[:4]) - 1)
    prior = latest_date[:4]
    # Find the point whose year/month best matches one year before.
    want = target_year + latest_date[4:7]  # 'YYYY-MM'
    for d, v in reversed(points[:-1]):
        if d[:7] <= want:
            return round(latest_val - v, 2)
    # Fall back to the oldest available.
    return round(latest_val - points[0][1], 2)


def _trend(yoy: float | None) -> str:
    if yoy is None:
        return "flat"
    if yoy > 0.05:
        return "rising"
    if yoy < -0.05:
        return "falling"
    return "flat"


def _fetch_series(series: str, sess: requests.Session) -> list[tuple[str, float]]:
    url = FREDGRAPH_CSV.format(series=series)
    for attempt in range(3):
        try:
            r = sess.get(url, timeout=HTTP_TIMEOUT)
            if r.status_code == 200 and r.text:
                return parse_fred_csv(r.text)
            return []
        except requests.RequestException as e:
            if attempt == 2:
                print(f"[macro] {series} fetch failed: {e}")
                return []
            time.sleep(1.0 * (attempt + 1))
    return []


def _series_stat(key: str, label: str, points: list[tuple[str, float]]) -> dict[str, Any] | None:
    if not points:
        return None
    date, value = points[-1]
    yoy = _yoy(points)
    return {
        "key": key,
        "label": label,
        "value": value,
        "as_of": date,
        "yoy_change": yoy,
        "trend": _trend(yoy),
    }


def run() -> dict[str, Any]:
    sess = _session()

    national: list[dict[str, Any]] = []
    for key, series, label in NATIONAL_SERIES:
        stat = _series_stat(key, label, _fetch_series(series, sess))
        if stat:
            national.append(stat)
        time.sleep(HTTP_SLEEP)

    states: dict[str, dict[str, Any]] = {}
    for st in STATES:
        stat = _series_stat("unemployment", f"{st} unemployment", _fetch_series(f"{st}UR", sess))
        if stat:
            states[st] = {
                "unemployment": stat["value"],
                "as_of": stat["as_of"],
                "yoy_change": stat["yoy_change"],
                "trend": stat["trend"],
            }
        time.sleep(HTTP_SLEEP)

    # A coarse national read: how many tracked stress series are rising YoY.
    rising = sum(1 for s in national if s["trend"] == "rising")
    stress_direction = (
        "rising" if rising > len(national) / 2
        else "easing" if rising == 0 and national
        else "mixed"
    )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "national": national,
        "states": states,
        "stress_direction": stress_direction,
    }
    storage_write(payload)
    print(
        f"[macro] national={len(national)} states={len(states)} "
        f"stress={stress_direction}"
    )
    return {
        "national_series": len(national),
        "states": len(states),
        "stress_direction": stress_direction,
        "snapshot_time": payload["generated_at"],
    }


def storage_write(payload: dict[str, Any]) -> None:
    # Local import keeps parse_fred_csv import-light for unit tests.
    from workers import storage

    storage.write_snapshot("macro", payload)


if __name__ == "__main__":
    print(f"[macro] done: {run()}")
