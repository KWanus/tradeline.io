"""Tests for the balance-sheet disposition proxy."""

from __future__ import annotations

from workers.disposition_proxy import detect_clears, _prior_quarter


def test_prior_quarter():
    assert _prior_quarter("20260331") == "20251231"
    assert _prior_quarter("20260630") == "20260331"
    assert _prior_quarter("20260930") == "20260630"
    assert _prior_quarter("20261231") == "20260930"


def test_detects_material_drop_off_sufficient_base():
    flagged = {
        "100": {"originator_name": "Cleared Bank", "state": "VA"},   # 50% drop
        "200": {"originator_name": "Steady Bank", "state": "NC"},    # 10% drop
        "300": {"originator_name": "Tiny Bank", "state": "GA"},      # 90% but small base
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


def test_missing_latest_treated_as_zero_balance_is_a_full_clear():
    flagged = {"100": {"originator_name": "Gone Bank", "state": "TX"}}
    out = detect_clears(flagged, {}, {"100": 8_000.0}, "20260331")
    assert len(out) == 1
    assert out[0]["drop_pct"] == 100.0


def test_unflagged_certs_ignored():
    # A cert that dropped but was never flagged should not appear.
    out = detect_clears({}, {"900": 0.0}, {"900": 10_000.0}, "20260331")
    assert out == []
