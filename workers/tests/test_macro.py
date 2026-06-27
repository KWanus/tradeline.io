"""Tests for the FRED macro parsing / stat logic (no network)."""

from __future__ import annotations

from workers.macro import parse_fred_csv, _series_stat, _yoy, _trend


def test_parse_drops_missing_points():
    csv_txt = "observation_date,X\n2025-01-01,2.5\n2025-02-01,.\n2025-03-01,2.7\n"
    pts = parse_fred_csv(csv_txt)
    assert pts == [("2025-01-01", 2.5), ("2025-03-01", 2.7)]


def test_yoy_uses_date_not_index():
    # Monthly series spanning > 1 year; YoY should compare to ~12 months back.
    pts = [(f"2025-{m:02d}-01", 3.0) for m in range(1, 13)] + [("2026-01-01", 3.6)]
    assert _yoy(pts) == 0.6  # 3.6 vs 2025-01 = 3.0


def test_trend_thresholds():
    assert _trend(0.5) == "rising"
    assert _trend(-0.5) == "falling"
    assert _trend(0.0) == "flat"
    assert _trend(None) == "flat"


def test_series_stat_shape():
    pts = [("2025-01-01", 2.75), ("2026-01-01", 2.92)]
    stat = _series_stat("cc_delinquency", "Credit-card delinquency rate", pts)
    assert stat["value"] == 2.92
    assert stat["as_of"] == "2026-01-01"
    assert stat["yoy_change"] == 0.17
    assert stat["trend"] == "rising"


def test_empty_series_is_none():
    assert _series_stat("k", "l", []) is None
