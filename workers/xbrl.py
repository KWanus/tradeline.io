"""XBRL companyfacts worker — pulls structured GAAP credit-quality time series for each bank.

This is the upgrade from text-window 10-Q heuristics to actual numbers:
  * net charge-offs (write-offs) over time
  * nonaccrual / NPL balances over time
  * allowance for credit losses (ACL) over time
  * provision for credit losses

Source: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json (free, official).

For each bank we extract the latest (most recent fiscal-period-end) point on a
small set of GAAP concepts and compare to the prior-quarter and prior-year
points. Material moves become scored signals.

Compliance: aggregate, public, originator-level. No consumer data.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests

from workers import storage
from workers.tickers import SEC_UA, Bank, load_banks

COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
SEC_RATE_LIMIT_SLEEP = 0.13

# GAAP concepts banks file under us-gaap. The list mixes post-CECL (current,
# adopted ~2020) and pre-CECL (legacy) names. Picker prefers whichever has the
# most-recent data, so older concepts here are fallbacks for banks that haven't
# migrated their reporting taxonomy yet.

# Net charge-offs / writeoffs of held-for-investment loans
CONCEPT_CHARGE_OFFS: tuple[str, ...] = (
    "FinancingReceivableExcludingAccruedInterestAllowanceForCreditLossWriteoffAfterRecovery",
    "FinancingReceivableExcludingAccruedInterestAllowanceForCreditLossWriteoff",
    "FinancingReceivableAllowanceForCreditLossesWriteOffs",
    "AllowanceForLoanAndLeaseLossesWriteOffs",
    "FinancingReceivableAccruedInterestWriteoff",
)
# Nonaccrual / NPL balance
CONCEPT_NONACCRUAL: tuple[str, ...] = (
    "FinancingReceivableNonaccrualBalance",
    "FinancingReceivableNonaccrualNoAllowance",
    "FinancingReceivableNonaccrualWithAllowance",
    "ImpairedFinancingReceivableRecordedInvestment",
    "LoansAndLeasesReceivableNonaccrualLoans",
)
# Allowance for credit losses (ACL)
CONCEPT_ALLOWANCE: tuple[str, ...] = (
    "FinancingReceivableAllowanceForCreditLossExcludingAccruedInterest",
    "FinancingReceivableAllowanceForCreditLosses",
    "AllowanceForLoanAndLeaseLossesAllowanceForLoanAndLeaseLossesPolicyExcludingAccruedInterest",
    "AllowanceForLoanAndLeaseLosses",
)
# Total loan portfolio (gross or net)
CONCEPT_LOANS_TOTAL: tuple[str, ...] = (
    "FinancingReceivableExcludingAccruedInterestBeforeAllowanceForCreditLoss",
    "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
    "LoansAndLeasesReceivableNetReportedAmount",
    "LoansAndLeasesReceivableGrossCarryingAmount",
)
# Provision for credit losses (income statement)
CONCEPT_PROVISION: tuple[str, ...] = (
    "ProvisionForLoanLeaseAndOtherLosses",
    "ProvisionForLoanAndLeaseLosses",
    "FinancingReceivableCreditLossExpenseReversal",
)

# Only score signals where the latest data point is at most this old.
# 200 days covers the standard 10-Q filing cadence (45-day deadline) plus slack.
RECENCY_DAYS = 200


@dataclass
class FactPoint:
    end: str   # ISO date
    val: float
    fy: int
    fp: str    # 'Q1'..'Q4','FY'
    form: str
    filed: str
    accn: str

    @classmethod
    def from_json(cls, j: dict[str, Any]) -> "FactPoint":
        return cls(
            end=str(j.get("end", "")),
            val=float(j.get("val", 0) or 0),
            fy=int(j.get("fy", 0) or 0),
            fp=str(j.get("fp", "") or ""),
            form=str(j.get("form", "")),
            filed=str(j.get("filed", "")),
            accn=str(j.get("accn", "")),
        )


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": SEC_UA, "Accept": "application/json"})
    return s


def _fetch_companyfacts(cik: str, sess: requests.Session) -> dict | None:
    r = sess.get(COMPANYFACTS_URL.format(cik=cik), timeout=60)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def _select_concept_series(
    facts: dict, candidates: tuple[str, ...]
) -> tuple[str | None, list[FactPoint]]:
    """Return (concept_name, series sorted asc by end) — pick the candidate
    whose latest data point is the most recent (i.e. the concept the bank is
    *currently* using). Falls back to legacy names when no modern concept
    has data."""
    us_gaap = (facts.get("facts", {}) or {}).get("us-gaap", {}) or {}
    best: tuple[str, list[FactPoint], str] | None = None  # (concept, series, latest_end)
    for concept in candidates:
        node = us_gaap.get(concept)
        if not node:
            continue
        units = node.get("units", {}) or {}
        usd = units.get("USD") or units.get("USD/shares") or []
        if not usd:
            continue
        kept: dict[tuple[str, str], FactPoint] = {}
        for raw in usd:
            try:
                p = FactPoint.from_json(raw)
            except Exception:
                continue
            if p.form not in {"10-Q", "10-K", "10-K/A", "10-Q/A"}:
                continue
            if not p.end:
                continue
            key = (p.end, p.fp)
            prior = kept.get(key)
            if prior is None or p.filed > prior.filed:
                kept[key] = p
        if len(kept) < 2:
            continue
        series = sorted(kept.values(), key=lambda x: x.end)
        latest_end = series[-1].end
        if best is None or latest_end > best[2]:
            best = (concept, series, latest_end)
    if best is None:
        return None, []
    return best[0], best[1]


def _is_recent(end_iso: str) -> bool:
    try:
        d = datetime.fromisoformat(end_iso).replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return (datetime.now(timezone.utc) - d).days <= RECENCY_DAYS


def _yoy_match(series: list[FactPoint]) -> tuple[FactPoint, FactPoint | None]:
    """Return (latest, prior-year-same-period). Compares only same fiscal-period
    labels (Q1, Q2, Q3, FY) so quarterly vs YTD reporting is apples-to-apples."""
    if not series:
        raise ValueError("empty series")
    latest = series[-1]
    prior_y: FactPoint | None = None
    for p in reversed(series[:-1]):
        if p.fp == latest.fp and (latest.fy - p.fy) == 1 and p.fy > 0:
            prior_y = p
            break
    return latest, prior_y


def _pct_change(new: float, old: float) -> float | None:
    if old == 0:
        return None
    return (new - old) / abs(old) * 100.0


def score_bank(bank: Bank, facts: dict) -> list[dict[str, Any]]:
    """Emit YoY-based credit-quality signals for a bank, gated on recency.
    Skip signals where the latest period is older than RECENCY_DAYS."""
    signals: list[dict[str, Any]] = []
    series_specs = (
        # (signal_type, candidates, yoy_threshold_pct)
        ("charge_off_increase", CONCEPT_CHARGE_OFFS, 30.0),
        ("npl_ratio_increase", CONCEPT_NONACCRUAL, 25.0),
        ("reserve_build", CONCEPT_ALLOWANCE, 20.0),
    )
    for stype, candidates, yoy_thresh_pct in series_specs:
        concept, series = _select_concept_series(facts, candidates)
        if not series:
            continue
        latest, prior_y = _yoy_match(series)
        if not _is_recent(latest.end):
            continue  # data too stale to act on
        if prior_y is None:
            continue  # no YoY comparable
        yoy = _pct_change(latest.val, prior_y.val)
        if yoy is None or yoy < yoy_thresh_pct:
            continue

        # Confidence: 0.55 floor at threshold, +0.01 per pp above, capped 0.95.
        conf = round(min(0.95, 0.55 + (yoy - yoy_thresh_pct) / 100.0), 2)

        signals.append(
            {
                "source": "sec_xbrl",
                "source_id": f"{bank.cik}:{concept}:{latest.end}:{latest.fp}",
                "cik": bank.cik,
                "ticker": bank.ticker,
                "originator_name": bank.name,
                "tier": bank.tier,
                "signal_type": stype,
                "confidence": conf,
                "filed_at": latest.filed + "T00:00:00+00:00",
                "form_type": latest.form,
                "concept": concept,
                "period_end": latest.end,
                "period_label": f"{latest.fy} {latest.fp}",
                "value": latest.val,
                "prior_year_value": prior_y.val,
                "yoy_pct": round(yoy, 2),
                "url": (
                    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany"
                    f"&CIK={bank.cik}&type={latest.form}&dateb=&owner=include"
                ),
                "rationale": f"{stype}: YoY {yoy:+.1f}% ({latest.fy} {latest.fp})",
            }
        )
    return signals


def run() -> dict[str, int]:
    banks = [b for b in load_banks() if b.cik]
    sess = _session()
    print(f"[xbrl] pulling companyfacts for {len(banks)} banks")

    all_signals: list[dict[str, Any]] = []
    seen_concepts: dict[str, int] = {}
    for bank in banks:
        try:
            facts = _fetch_companyfacts(bank.cik, sess)  # type: ignore[arg-type]
        except requests.HTTPError as e:
            print(f"[xbrl] {bank.ticker} http error: {e}")
            time.sleep(SEC_RATE_LIMIT_SLEEP)
            continue
        if not facts:
            print(f"[xbrl] {bank.ticker} no companyfacts")
            time.sleep(SEC_RATE_LIMIT_SLEEP)
            continue
        sigs = score_bank(bank, facts)
        if sigs:
            print(
                f"[xbrl] {bank.ticker} -> {len(sigs)} signal(s) "
                f"({', '.join(s['signal_type'] for s in sigs)})"
            )
            for s in sigs:
                seen_concepts[s["concept"]] = seen_concepts.get(s["concept"], 0) + 1
            all_signals.extend(sigs)
        time.sleep(SEC_RATE_LIMIT_SLEEP)

    written = storage.append("signals", all_signals, key_fields=("source", "source_id"))
    print(f"[xbrl] concept distribution: {seen_concepts}")
    return {
        "banks_scanned": len(banks),
        "signals_seen": len(all_signals),
        "signals_new": written,
        "snapshot_time": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(f"[xbrl] done: {run()}")
