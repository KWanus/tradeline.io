"""Tests for the balance-sheet disposition proxy."""

from __future__ import annotations

from workers.disposition_proxy import detect_clears, _prior_quarter, _lead_days


def _meta(name, state, first_flagged="2026-03-31"):
    return {"originator_name": name, "state": state, "first_flagged": first_flagged}


def test_prior_quarter():
    assert _prior_quarter("20260331") == "20251231"
    assert _prior_quarter("20260630") == "20260331"
    assert _prior_quarter("20260930") == "20260630"
    assert _prior_quarter("20261231") == "20260930"


def test_lead_days_math():
    assert _lead_days("20260331", "2025-09-30") == 182   # ~2 quarters early
    assert _lead_days("20260331", "2026-03-31") == 0     # same quarter
    assert _lead_days("20260331", "") is None


def test_detects_material_drop_off_sufficient_base():
    flagged = {
        "100": _meta("Cleared Bank", "VA"),   # 50% drop
        "200": _meta("Steady Bank", "NC"),    # 10% drop
        "300": _meta("Tiny Bank", "GA"),      # 90% but small base
    }
    prior = {"100": 10_000.0, "200": 10_000.0, "300": 1_000.0}
    latest = {"100": 5_000.0, "200": 9_000.0, "300": 100.0}
    out = detect_clears(flagged, latest, prior, "20260331")
    assert len(out) == 1
    e = out[0]
    assert e["cert"] == "100"
    assert e["ticker"] == "FDIC-100"
    assert e["signal_type"] == "balance_cleared_proxy"
    assert e["confidence"] == 0.5      # proxy, not a confirmed sale
    assert e["drop_pct"] == 50.0
    assert e["state"] == "VA"
    assert e["lead_days"] == 0         # flagged same quarter


def test_prior_quarter_flag_yields_lead_time():
    flagged = {"100": _meta("Early Bank", "TX", first_flagged="2025-09-30")}
    out = detect_clears(flagged, {"100": 3_000.0}, {"100": 10_000.0}, "20260331")
    assert len(out) == 1
    assert out[0]["lead_days"] == 182   # flagged ~2 quarters before the clear
    assert "after we first flagged it" in out[0]["rationale"]


def test_missing_latest_treated_as_zero_balance_is_a_full_clear():
    flagged = {"100": _meta("Gone Bank", "TX")}
    out = detect_clears(flagged, {}, {"100": 8_000.0}, "20260331")
    assert len(out) == 1
    assert out[0]["drop_pct"] == 100.0


def test_unflagged_certs_ignored():
    # A cert that dropped but was never flagged should not appear.
    out = detect_clears({}, {"900": 0.0}, {"900": 10_000.0}, "20260331")
    assert out == []
