"""Tests for the buyer-side market-pricing computation."""

from __future__ import annotations

from workers.buyers import compute_pricing, _series_by_end, _median


def test_cents_on_dollar_and_trend():
    par = {
        "2025-03-31": 1000.0, "2025-06-30": 1000.0, "2025-09-30": 1000.0,
        "2025-12-31": 1000.0, "2026-03-31": 1000.0,
    }
    price = {
        "2025-03-31": 100.0,  # 10.0 cents
        "2025-06-30": 105.0,
        "2025-09-30": 110.0,
        "2025-12-31": 115.0,
        "2026-03-31": 120.0,  # 12.0 cents
    }
    r = compute_pricing(par, price)
    assert r["latest_cents"] == 12.0
    assert r["as_of"] == "2026-03-31"
    assert r["yoy_change"] == 2.0      # 12.0 vs 10.0 four quarters earlier
    assert r["trend"] == "rising"
    assert len(r["series"]) == 5


def test_ignores_periods_missing_either_side_or_zero_par():
    par = {"2026-03-31": 0.0, "2025-12-31": 1000.0}
    price = {"2026-03-31": 120.0, "2025-12-31": 130.0}
    r = compute_pricing(par, price)
    # 2026-03-31 has zero par -> skipped; only 2025-12-31 remains.
    assert r["as_of"] == "2025-12-31"
    assert r["latest_cents"] == 13.0


def test_no_overlap_returns_none():
    assert compute_pricing({"2026-03-31": 1000.0}, {"2025-12-31": 100.0}) is None


def test_series_by_end_picks_usd_units():
    concept = {"units": {"USD": [
        {"end": "2025-12-31", "val": 500},
        {"end": "2026-03-31", "val": 600},
    ]}}
    assert _series_by_end(concept) == {"2025-12-31": 500.0, "2026-03-31": 600.0}


def test_median():
    assert _median([11.8, 13.2]) == 12.5
    assert _median([10.0, 12.0, 14.0]) == 12.0
    assert _median([]) is None
