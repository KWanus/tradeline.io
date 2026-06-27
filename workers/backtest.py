"""Backtest worker — turn the radar's heuristic confidence into a measured hit rate.

The radar emits two kinds of signal into the shared `signals` store:

  LEADING  — predictive stress signals that fire *before* a sale:
             charge_off_increase, npl_ratio_increase (FDIC/NCUA/XBRL),
             reserve_build (8-K 2.06), guidance_change (8-K 7.01/8.01).

  EVENT    — ground-truth dispositions, disclosed after the fact:
             portfolio_sale_announced / divestiture_announced (8-K item 2.01).

This worker joins them: for every disposition EVENT, did we have a LEADING
signal on the *same originator* in the window before it? That converts an
unvalidated "confidence: 0.82" into a falsifiable statement — "we flagged N of
the last M disclosed portfolio sales, a median of D days early" — which is the
track record a buyer can show a credit committee.

Honest scope: disposition EVENTs come from SEC 8-K item 2.01, so the backtest
population is SEC-filing originators (public banks / lenders). Community banks
and credit unions rarely file 8-Ks, so their outcomes can't be backtested from
public filings yet — that needs marketplace-listing ingestion (EverChain /
Debexpert / NLEX), tracked on the roadmap. We surface that caveat rather than
hide it.

Output: data/output/backtest.json (also embedded into the radar snapshot as
`track_record`). Recomputed each run from the full signal history — not an
append-only stream.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from workers import storage

# Predictive signals — the "call this bank" flags that should precede a sale.
LEADING_TYPES = {
    "charge_off_increase",
    "npl_ratio_increase",
    "reserve_build",
    "guidance_change",
}

# Ground-truth disposition events, tiered by how sure we are it's a *debt*
# sale. CONFIRMED = 8-K item 2.01 whose doc text matched portfolio/loan
# keywords. CANDIDATE = a generic item-2.01 disposition (could be M&A, a branch
# sale, real estate) — counted separately so it can't inflate the headline.
CONFIRMED_EVENT_TYPES = {"portfolio_sale_announced"}
CANDIDATE_EVENT_TYPES = {"divestiture_announced"}
EVENT_TYPES = CONFIRMED_EVENT_TYPES | CANDIDATE_EVENT_TYPES
# Note: balance_cleared_proxy events live in the `dispositions` store too, but
# are NOT backtest events — they're surfaced as standalone supply intelligence
# (a flag and its same-quarter clear have no lead time to measure). Once flags
# accumulate across quarters, a prior-quarter flag → later-quarter clear becomes
# a measurable signal; that's a future enhancement.

# How far before an event a leading signal still counts as "predicting" it.
# 540 days ≈ 6 quarters — long enough to catch charge-off acceleration that
# builds over a year before a bank finally sells, short enough to stay causal.
DEFAULT_WINDOW_DAYS = 540

# Max per-event rows to embed in the snapshot (UI list). Aggregates use all.
MAX_EVENT_ROWS = 80


def _parse_dt(s: str) -> datetime | None:
    """Parse an ISO timestamp; tolerate a trailing 'Z' and bare dates."""
    if not s:
        return None
    txt = str(s).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(txt)
    except ValueError:
        try:
            dt = datetime.fromisoformat(txt[:10])
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _key(sig: dict[str, Any]) -> str:
    """Stable originator identity: CIK first (most reliable), then ticker, then
    a normalized name. Lets a leading XBRL signal and an 8-K event on the same
    company join even if one lacks a ticker."""
    cik = str(sig.get("cik") or "").strip().lstrip("0")
    if cik:
        return f"cik:{cik}"
    ticker = str(sig.get("ticker") or "").strip().upper()
    if ticker:
        return f"tkr:{ticker}"
    name = str(sig.get("originator_name") or "").strip().lower()
    return f"nm:{name}" if name else ""


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def compute_backtest(
    signals: list[dict[str, Any]], window_days: int = DEFAULT_WINDOW_DAYS
) -> dict[str, Any]:
    """Pure join of leading signals to disposition events. No I/O — unit-tested."""
    leading: dict[str, list[tuple[datetime, dict[str, Any]]]] = {}
    events: list[tuple[datetime, dict[str, Any]]] = []

    for sig in signals:
        stype = str(sig.get("signal_type") or "")
        dt = _parse_dt(sig.get("filed_at") or sig.get("period_end") or "")
        key = _key(sig)
        if not dt or not key:
            continue
        if stype in LEADING_TYPES:
            leading.setdefault(key, []).append((dt, sig))
        elif stype in EVENT_TYPES:
            events.append((dt, sig))

    # Sort each originator's leading signals oldest-first so we can pick the
    # earliest qualifying one (the longest, most impressive honest lead time).
    for key in leading:
        leading[key].sort(key=lambda x: x[0])

    rows: list[dict[str, Any]] = []
    lead_days_all: list[float] = []
    by_leading_type: dict[str, int] = {}

    # Dedupe events: amended/duplicate 8-Ks on the same day for the same
    # originator shouldn't inflate the denominator.
    seen_events: set[tuple[str, str]] = set()

    for event_dt, ev in sorted(events, key=lambda x: x[0], reverse=True):
        key = _key(ev)
        ev_day = event_dt.date().isoformat()
        if (key, ev_day) in seen_events:
            continue
        seen_events.add((key, ev_day))

        # Earliest leading signal strictly before the event, within the window.
        match: dict[str, Any] | None = None
        match_dt: datetime | None = None
        for ld_dt, ld in leading.get(key, []):
            if ld_dt >= event_dt:
                break  # sorted oldest-first; nothing after this is earlier
            if (event_dt - ld_dt).days <= window_days:
                match, match_dt = ld, ld_dt
                break  # earliest qualifying = longest lead

        predicted = match is not None
        lead_days = (event_dt - match_dt).days if (predicted and match_dt) else None
        if predicted and lead_days is not None:
            lead_days_all.append(float(lead_days))
            lt = str(match.get("signal_type") or "")
            by_leading_type[lt] = by_leading_type.get(lt, 0) + 1

        rows.append(
            {
                "originator_name": ev.get("originator_name") or ev.get("ticker") or "—",
                "ticker": ev.get("ticker"),
                "event_type": ev.get("signal_type"),
                "confirmed": str(ev.get("signal_type")) in CONFIRMED_EVENT_TYPES,
                "event_date": event_dt.date().isoformat(),
                "event_url": ev.get("url"),
                "predicted": predicted,
                "lead_days": lead_days,
                "leading_type": match.get("signal_type") if predicted else None,
                "leading_date": match_dt.date().isoformat() if (predicted and match_dt) else None,
                "leading_url": match.get("url") if predicted else None,
                "leading_yoy_pct": match.get("yoy_pct") if predicted else None,
            }
        )

    # Headline metrics use CONFIRMED debt sales only — generic dispositions are
    # reported separately so a pile of M&A 8-Ks can't move the hit rate.
    confirmed = [r for r in rows if r["confirmed"]]
    candidate = [r for r in rows if not r["confirmed"]]
    confirmed_predicted = sum(1 for r in confirmed if r["predicted"])
    candidate_predicted = sum(1 for r in candidate if r["predicted"])

    def _rate(num: int, den: int) -> float | None:
        return round(num / den, 3) if den else None

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_days": window_days,
        # Headline = confirmed debt-portfolio sales.
        "confirmed_total": len(confirmed),
        "confirmed_predicted": confirmed_predicted,
        "hit_rate": _rate(confirmed_predicted, len(confirmed)),
        # Generic item-2.01 dispositions (M&A / branch / RE) — context only.
        "candidate_total": len(candidate),
        "candidate_predicted": candidate_predicted,
        "candidate_hit_rate": _rate(candidate_predicted, len(candidate)),
        # Combined, for the "instrumentation is live" view.
        "events_total": len(rows),
        "events_predicted": sum(1 for r in rows if r["predicted"]),
        "median_lead_days": _median(lead_days_all),
        "avg_lead_days": round(sum(lead_days_all) / len(lead_days_all), 1)
        if lead_days_all
        else None,
        "by_leading_type": by_leading_type,
        "events": rows[:MAX_EVENT_ROWS],
        # Population caveat — surfaced in the UI, not hidden.
        "population": "Disposition events from SEC 8-K item 2.01, completed-sale "
        "news, and operator-logged marketplace listings (data/seed/listings.csv). "
        "Leading signals from SEC/XBRL + FDIC/NCUA Call Reports. Add listings as "
        "you see them to grow the confirmed-sale ground truth.",
    }


def run(window_days: int = DEFAULT_WINDOW_DAYS) -> dict[str, Any]:
    # Leading signals come from SEC/XBRL (`signals`) and the Call Report streams
    # (`fdic_signals` / `ncua_signals`). Disposition EVENTS come from SEC 8-Ks
    # (in `signals`) and the dedicated `dispositions` stream (news + operator
    # marketplace listings). compute_backtest partitions by signal_type.
    pool = (
        storage.read_all("signals")
        + storage.read_all("fdic_signals")
        + storage.read_all("ncua_signals")
        + storage.read_all("dispositions")
    )
    result = compute_backtest(pool, window_days=window_days)
    storage.write_snapshot("backtest", result)
    print(
        f"[backtest] events={result['events_total']} "
        f"predicted={result['events_predicted']} "
        f"hit_rate={result['hit_rate']} "
        f"median_lead_days={result['median_lead_days']}"
    )
    return result


if __name__ == "__main__":
    print(f"[backtest] done: {run()}")
