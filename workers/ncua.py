"""NCUA Call Report worker — credit-union credit-quality signals.

The FDIC worker covers FDIC-insured *banks*. Credit unions are regulated by
the NCUA, not the FDIC, and never appear in FDIC data. They are member-owned,
they routinely sell charged-off auto and credit-card paper, and almost nobody
competes for that flow — the best first-tape targets for a new buyer.

Unlike the FDIC, the NCUA has no clean JSON API. It publishes quarterly 5300
Call Report data as bulk ZIP downloads of comma-delimited text files. This
worker downloads the latest quarter + the same quarter a year earlier, joins
each credit union's financials across the two, and scores material YoY
increases in net charge-offs / delinquent loans.

Source: https://ncua.gov  (public quarterly bulk data, no key).
Compliance: aggregate, public, institution-level. No consumer data.

Output: signals written to data/output/ncua_signals.jsonl, kept as their own
stream (NCUA credit unions are keyed by charter number, not stock ticker).

  VERIFY POINTS (the two fragile pieces — NCUA reorganizes its bulk data
  periodically; the worker fails safe to empty rather than crashing if either
  drifts):
    1. NCUA_ZIP_URL — the quarterly bulk-download URL pattern.
    2. The Acct_* account-code column names below — confirm against the
       current NCUA 5300 Call Report data dictionary.
"""

from __future__ import annotations

import csv
import io
import time
import zipfile
from datetime import datetime, timezone
from typing import Any

import requests

from workers import storage

# Quarterly bulk-data ZIP. {yyyy}/{mm} are a quarter-end. VERIFY each cycle.
NCUA_ZIP_URL = (
    "https://ncua.gov/files/publications/analysis/call-report-data-{yyyy}-{mm}.zip"
)
# Public per-credit-union profile page for the signal's "open source" link.
NCUA_PROFILE_URL = "https://mapping.ncua.gov/ResearchCreditUnion?cu={charter}"

HTTP_UA = "Tradeline radar (workers/ncua.py; hello@tradeline.io)"

# Quarter-end months, newest-first — we probe these to find the latest published.
QUARTER_MONTHS = ("12", "09", "06", "03")

# NCUA 5300 account-code columns. VERIFY against the current data dictionary.
# Lookups below are fuzzy (case-insensitive, with/without the "Acct_" prefix),
# so minor header drift still resolves.
ACCT_TOTAL_ASSETS = "Acct_010"
ACCT_CHARGEOFFS_YTD = "Acct_550"   # loans charged off, year-to-date
ACCT_RECOVERIES_YTD = "Acct_551"   # recoveries on charged-off loans, YTD
ACCT_DELINQUENT_TOTAL = "Acct_041B"  # total delinquent loans (60+ days)

# Institution-master file and the financial-statement file inside the ZIP.
MASTER_FILE = "FOICU.txt"
FINANCIALS_FILE = "FS220.txt"
DELINQUENCY_FILE = "FS220D.txt"

# Signal thresholds — matched to the FDIC worker so signals are comparable.
NPL_YOY_THRESHOLD = 25.0
CHARGEOFF_YOY_THRESHOLD = 30.0

# Absolute-materiality floor (dollars): ignore big % moves off a trivial base.
MATERIALITY_FLOOR = 250_000

HTTP_TIMEOUT = 120


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": HTTP_UA})
    return s


def _num(rec: dict[str, Any], key: str) -> float:
    v = rec.get(key)
    if v is None or v == "":
        return 0.0
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def _pct_change(new: float, old: float) -> float | None:
    if old <= 0:
        return None
    return (new - old) / abs(old) * 100.0


def _find_col(header: list[str], wanted: str) -> str | None:
    """Resolve a column name fuzzily: exact, case-insensitive, and with the
    'Acct_' prefix stripped on both sides."""
    norm = lambda s: s.strip().lower().replace("acct_", "")
    target = norm(wanted)
    for col in header:
        if norm(col) == target:
            return col
    return None


def _quarter_label(yyyy: str, mm: str) -> str:
    q = {"03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4"}.get(mm, "?")
    return f"{yyyy} {q}"


def _repdte_iso(yyyy: str, mm: str) -> str:
    day = {"03": "31", "06": "30", "09": "30", "12": "31"}.get(mm, "30")
    return f"{yyyy}-{mm}-{day}T00:00:00+00:00"


def _download_zip(
    yyyy: str, mm: str, sess: requests.Session
) -> zipfile.ZipFile | None:
    url = NCUA_ZIP_URL.format(yyyy=yyyy, mm=mm)
    try:
        r = sess.get(url, timeout=HTTP_TIMEOUT)
    except requests.RequestException as e:
        print(f"[ncua] download error {yyyy}-{mm}: {e}")
        return None
    if r.status_code != 200 or not r.content:
        return None
    try:
        return zipfile.ZipFile(io.BytesIO(r.content))
    except zipfile.BadZipFile:
        print(f"[ncua] bad zip {yyyy}-{mm}")
        return None


def _read_table(zf: zipfile.ZipFile, filename: str) -> list[dict[str, Any]]:
    """Read one comma-delimited member file into a list of dict rows.
    Member matching is case-insensitive; missing file -> empty list."""
    member = next(
        (n for n in zf.namelist() if n.lower().endswith(filename.lower())),
        None,
    )
    if not member:
        return []
    try:
        raw = zf.read(member).decode("latin-1", errors="replace")
    except KeyError:
        return []
    reader = csv.DictReader(io.StringIO(raw))
    return [row for row in reader]


def _load_quarter(
    yyyy: str, mm: str, sess: requests.Session
) -> dict[str, dict[str, Any]]:
    """Return {charter_number: merged-financials} for one quarter, or {}.

    Joins the institution master, the financial-statement file, and the
    delinquency file on the credit-union charter number."""
    zf = _download_zip(yyyy, mm, sess)
    if not zf:
        return {}

    master = _read_table(zf, MASTER_FILE)
    financials = _read_table(zf, FINANCIALS_FILE)
    delinquency = _read_table(zf, DELINQUENCY_FILE)
    if not master or not financials:
        print(f"[ncua] {yyyy}-{mm}: master/financials missing inside zip")
        return {}

    def _charter(row: dict[str, Any]) -> str:
        for k in ("CU_NUMBER", "cu_number", "CHARTER", "Charter"):
            if row.get(k):
                return str(row[k]).strip()
        return ""

    fin_by_cu = {_charter(r): r for r in financials if _charter(r)}
    del_by_cu = {_charter(r): r for r in delinquency if _charter(r)}

    merged: dict[str, dict[str, Any]] = {}
    for m in master:
        cu = _charter(m)
        if not cu:
            continue
        row = dict(m)
        row.update(fin_by_cu.get(cu, {}))
        row.update(del_by_cu.get(cu, {}))
        merged[cu] = row
    return merged


def _resolve_latest_quarter(
    sess: requests.Session,
) -> tuple[str, str] | None:
    """Probe recent quarter-ends newest-first; return the first that downloads."""
    now = datetime.now(timezone.utc)
    for year_offset in range(0, 2):
        yyyy = str(now.year - year_offset)
        for mm in QUARTER_MONTHS:
            # Skip future quarters.
            if year_offset == 0 and int(mm) > now.month:
                continue
            if _download_zip(yyyy, mm, sess) is not None:
                return yyyy, mm
            time.sleep(0.3)
    return None


def score(
    cu: str,
    latest: dict[str, Any],
    prior: dict[str, Any],
    header: list[str],
    yyyy: str,
    mm: str,
) -> list[dict[str, Any]]:
    """Emit YoY credit-quality signals for one credit union."""
    name = ""
    for k in ("CU_NAME", "cu_name", "NAME"):
        if latest.get(k):
            name = str(latest[k]).strip()
            break
    state = ""
    for k in ("STATE", "state", "STATE_CODE", "CU_STATE"):
        if latest.get(k):
            state = str(latest[k]).strip()
            break
    # City from the FOICU master (joined upstream) so the radar can show
    # "Texarkana, TX" — buyers want local sellers, not just a state. NCUA
    # reports county only as a numeric code, so we surface city only.
    city = ""
    for k in ("CITY", "city"):
        if latest.get(k):
            raw = str(latest[k]).strip()
            city = raw.title() if raw.isupper() else raw
            break

    co_col = _find_col(header, ACCT_CHARGEOFFS_YTD)
    rec_col = _find_col(header, ACCT_RECOVERIES_YTD)
    del_col = _find_col(header, ACCT_DELINQUENT_TOTAL)
    asset_col = _find_col(header, ACCT_TOTAL_ASSETS)

    asset = _num(latest, asset_col) if asset_col else 0.0
    tier = "credit-union"

    signals: list[dict[str, Any]] = []

    def _emit(stype: str, new_val: float, old_val: float, concept: str) -> None:
        if new_val < MATERIALITY_FLOOR or new_val <= 0:
            return
        threshold = (
            CHARGEOFF_YOY_THRESHOLD
            if stype == "charge_off_increase"
            else NPL_YOY_THRESHOLD
        )
        yoy = _pct_change(new_val, old_val)
        if yoy is None or yoy < threshold:
            return
        conf = round(min(0.95, 0.55 + (yoy - threshold) / 100.0), 2)
        signals.append(
            {
                "source": "ncua_call_report",
                "source_id": f"{cu}:{stype}:{yyyy}{mm}",
                "cert": cu,  # charter number — UI treats this like FDIC's cert
                "ticker": f"NCUA-{cu}",
                "originator_name": name or f"Credit Union #{cu}",
                "state": state,
                "city": city,
                "county": "",
                "tier": tier,
                "signal_type": stype,
                "confidence": conf,
                "filed_at": _repdte_iso(yyyy, mm),
                "form_type": "NCUA 5300 Call Report",
                "concept": concept,
                "period_end": _repdte_iso(yyyy, mm)[:10],
                "period_label": _quarter_label(yyyy, mm),
                "value": new_val,
                "prior_year_value": old_val,
                "yoy_pct": round(yoy, 2),
                "asset_total": asset / 1000.0,  # dollars -> $thousands (FDIC parity)
                "url": NCUA_PROFILE_URL.format(charter=cu),
                "rationale": (
                    f"{stype}: {name} ({state}) YoY {yoy:+.1f}% "
                    f"on {concept} ({_quarter_label(yyyy, mm)})"
                ),
            }
        )

    # Net charge-offs = charge-offs YTD minus recoveries YTD.
    if co_col:
        new_co = _num(latest, co_col) - (_num(latest, rec_col) if rec_col else 0.0)
        old_co = _num(prior, co_col) - (_num(prior, rec_col) if rec_col else 0.0)
        _emit("charge_off_increase", new_co, old_co, "net_charge_offs")

    if del_col:
        _emit(
            "npl_ratio_increase",
            _num(latest, del_col),
            _num(prior, del_col),
            "delinquent_loans",
        )

    return signals


def run() -> dict[str, Any]:
    sess = _session()

    resolved = _resolve_latest_quarter(sess)
    if not resolved:
        print("[ncua] could not resolve a downloadable quarter")
        return {"credit_unions_scanned": 0, "signals_seen": 0, "signals_new": 0}
    yyyy, mm = resolved
    prior_yyyy = str(int(yyyy) - 1)
    print(f"[ncua] latest={yyyy}-{mm} prior-year={prior_yyyy}-{mm}")

    latest = _load_quarter(yyyy, mm, sess)
    print(f"[ncua] latest quarter: {len(latest)} credit unions")
    prior = _load_quarter(prior_yyyy, mm, sess)
    print(f"[ncua] prior-year quarter: {len(prior)} credit unions")

    if not latest or not prior:
        print("[ncua] insufficient data for YoY comparison")
        return {
            "credit_unions_scanned": len(latest),
            "signals_seen": 0,
            "signals_new": 0,
        }

    header = list(next(iter(latest.values())).keys())

    all_signals: list[dict[str, Any]] = []
    for cu, rec in latest.items():
        prior_rec = prior.get(cu)
        if not prior_rec:
            continue  # no YoY comparable (new charter, merger, etc.)
        all_signals.extend(score(cu, rec, prior_rec, header, yyyy, mm))

    by_type: dict[str, int] = {}
    for s in all_signals:
        by_type[s["signal_type"]] = by_type.get(s["signal_type"], 0) + 1

    written = storage.append(
        "ncua_signals", all_signals, key_fields=("source", "source_id")
    )
    print(f"[ncua] signal types: {by_type}")
    return {
        "credit_unions_scanned": len(latest),
        "signals_seen": len(all_signals),
        "signals_new": written,
        "latest_quarter": f"{yyyy}-{mm}",
        "snapshot_time": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(f"[ncua] done: {run()}")
