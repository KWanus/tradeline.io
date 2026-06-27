"""FDIC Call Report worker — community-bank credit-quality signals.

SEC EDGAR + XBRL only cover *publicly-traded* banks. The community banks
that sell small, clean first tapes to new debt buyers mostly don't file
with the SEC at all — they file quarterly Call Reports with the FDIC.

This worker pulls FDIC BankFind financial data, compares each community
bank's latest quarter to the same quarter a year earlier, and scores
material increases in noncurrent loans / net charge-offs as signals.

Source: https://api.fdic.gov/banks/financials  (public, no key, JSON).
Compliance: aggregate, public, institution-level. No consumer data.

Output: signals written to data/output/fdic_signals.jsonl. These are kept
as their own stream (separate from the SEC `signals` store) because FDIC
institutions are keyed by FDIC certificate number, not stock ticker.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import requests

from workers import storage

FINANCIALS_URL = "https://api.fdic.gov/banks/financials"
# The financials endpoint omits location; the institutions endpoint carries
# CITY / COUNTY / STNAME. We pull a CERT->geo map once and join, so each signal
# can say "Roanoke, VA" instead of just "VA" — buyers want *local* sellers they
# can call directly, not just a state.
INSTITUTIONS_URL = "https://banks.data.fdic.gov/api/institutions"
BANKFIND_DETAIL = "https://banks.data.fdic.gov/bankfind-suite/bankfind/details/{cert}"

# Courteous identifying User-Agent. FDIC's API is open, but identifying the
# client is good citizenship and helps if they ever need to reach us.
HTTP_UA = "Tradeline radar (workers/fdic.py; hello@tradeline.io)"

# Community-bank universe: total assets in $thousands. $100M floor (smaller
# than that rarely has sellable tape volume); $10B ceiling (above that isn't
# a "community" bank and is likely already an SEC filer the XBRL worker covers).
ASSET_MIN = 100_000
ASSET_MAX = 10_000_000

# Per-page size for the financials endpoint. The endpoint accepts large
# limits; 10k keeps the whole community-bank universe to ~1 page.
PAGE_SIZE = 10_000

# Financial fields we pull per institution-quarter. The NT* fields at the end
# are per-asset-class net charge-offs (verified live against api.fdic.gov):
#   NTCI   — commercial & industrial
#   NTRE   — real estate (all)
#   NTCRCD — credit cards
#   NTAUTO — auto loans
# Used to compute a breakdown so cards can say "mostly auto (62%)" instead
# of "charge-offs are up." Defensive parsing — missing fields stay 0.
FIELDS = (
    "CERT,NAME,STALP,REPDTE,ASSET,LNLSNET,NCLNLS,NTLNLSQ,NTLNLSR,P9ASSET,"
    "NTCI,NTRE,NTCRCD,NTAUTO"
)

# Asset-class label → API field name for the breakdown emit. Order is
# stable so the dict iterates the same way on every run.
ASSET_CLASS_FIELDS: tuple[tuple[str, str], ...] = (
    ("credit_card", "NTCRCD"),
    ("auto", "NTAUTO"),
    ("real_estate", "NTRE"),
    ("commercial", "NTCI"),
)

# Signal thresholds — YoY % increase required to score. Matched to the XBRL
# worker's thresholds so SEC and FDIC signals are calibrated the same way.
NPL_YOY_THRESHOLD = 25.0
CHARGEOFF_YOY_THRESHOLD = 30.0

# Absolute-materiality floor: ignore big percentage moves off a trivial base.
# A bank with $40k of noncurrent loans tripling to $120k is noise.
NCLNLS_FLOOR = 500  # $thousands -> $500k

HTTP_SLEEP = 0.2


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": HTTP_UA, "Accept": "application/json"})
    return s


def _fetch_financials(
    repdte: str, sess: requests.Session
) -> list[dict[str, Any]]:
    """Pull every community bank's Call Report row for one report date.

    Paginates with offset until the dataset is exhausted. Each FDIC record
    nests its columns under a `data` key — we unwrap to a flat dict.
    """
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        params = {
            "filters": (
                f"REPDTE:{repdte} AND "
                f"ASSET:[{ASSET_MIN} TO {ASSET_MAX}]"
            ),
            "fields": FIELDS,
            "limit": PAGE_SIZE,
            "offset": offset,
            "sort_by": "CERT",
            "sort_order": "ASC",
        }
        r = sess.get(FINANCIALS_URL, params=params, timeout=90)
        r.raise_for_status()
        payload = r.json()
        batch = payload.get("data", []) or []
        for item in batch:
            rec = item.get("data") if isinstance(item, dict) else None
            if rec:
                rows.append(rec)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(HTTP_SLEEP)
    return rows


def _title_case(s: str) -> str:
    """FDIC city names arrive mixed/upper-case ('MCLEAN', 'Alexandria').
    Title-case only when the source is all-caps so we don't mangle casing
    that's already correct."""
    s = s.strip()
    if s and s.isupper():
        return s.title()
    return s


def _fetch_geo(sess: requests.Session) -> dict[str, dict[str, str]]:
    """Map FDIC CERT -> {city, county} for the community-bank universe.

    One paginated pass over the institutions endpoint (active banks in the
    same asset band as the financial scan). Failure is non-fatal — signals
    still emit, just without the local city/county enrichment.
    """
    geo: dict[str, dict[str, str]] = {}
    offset = 0
    while True:
        params = {
            "filters": f"ACTIVE:1 AND ASSET:[{ASSET_MIN} TO {ASSET_MAX}]",
            "fields": "CERT,CITY,COUNTY,STALP",
            "limit": PAGE_SIZE,
            "offset": offset,
            "sort_by": "CERT",
            "sort_order": "ASC",
        }
        try:
            r = sess.get(INSTITUTIONS_URL, params=params, timeout=90)
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"[fdic] geo fetch error (continuing without city/county): {e}")
            break
        batch = r.json().get("data", []) or []
        for item in batch:
            rec = item.get("data") if isinstance(item, dict) else None
            if not rec or rec.get("CERT") is None:
                continue
            geo[str(rec["CERT"])] = {
                "city": _title_case(str(rec.get("CITY") or "")),
                "county": _title_case(str(rec.get("COUNTY") or "")),
            }
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(HTTP_SLEEP)
    return geo


def _latest_repdte(sess: requests.Session) -> str | None:
    """Most recent report date the FDIC has published."""
    params = {
        "fields": "REPDTE",
        "limit": 1,
        "sort_by": "REPDTE",
        "sort_order": "DESC",
    }
    r = sess.get(FINANCIALS_URL, params=params, timeout=60)
    r.raise_for_status()
    data = r.json().get("data", []) or []
    if not data:
        return None
    return str(data[0].get("data", {}).get("REPDTE") or "") or None


def _prior_year_repdte(repdte: str) -> str:
    """'20251231' -> '20241231'. Call Report dates are always quarter-ends,
    so subtracting one from the year keeps the same quarter."""
    return str(int(repdte[:4]) - 1) + repdte[4:]


def _num(rec: dict[str, Any], key: str) -> float:
    v = rec.get(key)
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _pct_change(new: float, old: float) -> float | None:
    if old <= 0:
        return None
    return (new - old) / abs(old) * 100.0


def _repdte_to_iso(repdte: str) -> str:
    """'20251231' -> '2025-12-31T00:00:00+00:00'."""
    return f"{repdte[:4]}-{repdte[4:6]}-{repdte[6:8]}T00:00:00+00:00"


def _quarter_label(repdte: str) -> str:
    """'20251231' -> '2025 Q4'."""
    month = repdte[4:6]
    q = {"03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4"}.get(month, "?")
    return f"{repdte[:4]} {q}"


def score(
    latest: dict[str, Any],
    prior: dict[str, Any],
    geo: dict[str, dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    """Emit YoY credit-quality signals for one community bank."""
    cert = str(latest.get("CERT") or "")
    name = str(latest.get("NAME") or "").strip()
    state = str(latest.get("STALP") or "").strip()
    repdte = str(latest.get("REPDTE") or "")
    if not cert or not repdte:
        return []

    # Local geography (city/county) joined from the institutions endpoint so
    # buyers can find sellers in their own area, not just their state.
    g = (geo or {}).get(cert, {})
    city = g.get("city", "")
    county = g.get("county", "")

    asset = _num(latest, "ASSET")
    tier = "community" if asset < 1_000_000 else "regional"

    # Per-asset-class net charge-off breakdown — populated only for the
    # charge-off signal type (delinquency signals are loan-balance based
    # and don't get a per-class breakdown). Built once and attached
    # below so cards can show "mostly auto (62%)" instead of just "up Y%".
    breakdown: dict[str, float] = {}
    for label, fdic_field in ASSET_CLASS_FIELDS:
        v = _num(latest, fdic_field)
        if v > 0:
            breakdown[label] = v

    signals: list[dict[str, Any]] = []

    specs = (
        # (signal_type, field, threshold, materiality_floor)
        ("npl_ratio_increase", "NCLNLS", NPL_YOY_THRESHOLD, NCLNLS_FLOOR),
        ("charge_off_increase", "NTLNLSQ", CHARGEOFF_YOY_THRESHOLD, 0.0),
    )
    for stype, field, threshold, floor in specs:
        new_val = _num(latest, field)
        old_val = _num(prior, field)
        if new_val < floor:
            continue
        if new_val <= 0:
            continue  # net recoveries / no noncurrent balance — not a signal
        yoy = _pct_change(new_val, old_val)
        if yoy is None or yoy < threshold:
            continue

        # Confidence: 0.55 floor at threshold, +0.01 per pp above, cap 0.95.
        conf = round(min(0.95, 0.55 + (yoy - threshold) / 100.0), 2)

        # Only charge-off signals carry the per-asset-class breakdown —
        # delinquency is a loan-balance metric, not a per-class CO measure.
        # FDIC reports financial values in $thousands; NCUA stores them in
        # dollars. Normalize FDIC to dollars here so downstream enrichment
        # math (annualize × sale rate × ¢/dollar) is consistent across both.
        signal_breakdown = (
            {k: v * 1000.0 for k, v in breakdown.items()}
            if stype == "charge_off_increase"
            else {}
        )

        signals.append(
            {
                "source": "fdic_call_report",
                "source_id": f"{cert}:{stype}:{repdte}",
                "cert": cert,
                # FDIC banks have no stock ticker — use a synthetic stable key.
                "ticker": f"FDIC-{cert}",
                "originator_name": name,
                "state": state,
                "city": city,
                "county": county,
                "tier": tier,
                "signal_type": stype,
                "confidence": conf,
                "filed_at": _repdte_to_iso(repdte),
                "form_type": "Call Report",
                "concept": field,
                "period_end": _repdte_to_iso(repdte)[:10],
                "period_label": _quarter_label(repdte),
                # value/prior_year_value normalized to dollars (×1000).
                "value": new_val * 1000.0,
                "prior_year_value": old_val * 1000.0,
                "yoy_pct": round(yoy, 2),
                "asset_total": asset,
                "breakdown": signal_breakdown,
                "url": BANKFIND_DETAIL.format(cert=cert),
                "rationale": (
                    f"{stype}: {name} ({state}) YoY {yoy:+.1f}% "
                    f"on {field} ({_quarter_label(repdte)})"
                ),
            }
        )
    return signals


def run() -> dict[str, Any]:
    sess = _session()

    latest_repdte = _latest_repdte(sess)
    if not latest_repdte:
        print("[fdic] could not resolve latest report date")
        return {"banks_scanned": 0, "signals_seen": 0, "signals_new": 0}
    prior_repdte = _prior_year_repdte(latest_repdte)
    print(f"[fdic] latest={latest_repdte} prior-year={prior_repdte}")

    latest_rows = _fetch_financials(latest_repdte, sess)
    print(f"[fdic] latest quarter: {len(latest_rows)} community banks")
    time.sleep(HTTP_SLEEP)
    prior_rows = _fetch_financials(prior_repdte, sess)
    print(f"[fdic] prior-year quarter: {len(prior_rows)} community banks")
    time.sleep(HTTP_SLEEP)
    geo = _fetch_geo(sess)
    print(f"[fdic] geo: city/county for {len(geo)} institutions")

    prior_by_cert = {str(r.get("CERT")): r for r in prior_rows if r.get("CERT")}

    all_signals: list[dict[str, Any]] = []
    for rec in latest_rows:
        cert = str(rec.get("CERT") or "")
        prior = prior_by_cert.get(cert)
        if not prior:
            continue  # no YoY comparable (new charter, merger, etc.)
        all_signals.extend(score(rec, prior, geo))

    by_type: dict[str, int] = {}
    for s in all_signals:
        by_type[s["signal_type"]] = by_type.get(s["signal_type"], 0) + 1

    written = storage.append(
        "fdic_signals", all_signals, key_fields=("source", "source_id")
    )
    print(f"[fdic] signal types: {by_type}")
    return {
        "banks_scanned": len(latest_rows),
        "signals_seen": len(all_signals),
        "signals_new": written,
        "latest_repdte": latest_repdte,
        "snapshot_time": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(f"[fdic] done: {run()}")
