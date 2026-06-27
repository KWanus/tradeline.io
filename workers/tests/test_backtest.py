"""Tests for the signal -> disposition backtest join."""

from __future__ import annotations

from workers.backtest import compute_backtest


def _sig(**kw):
    base = {
        "cik": "100",
        "ticker": "ABC",
        "originator_name": "ABC Bancorp",
        "signal_type": "charge_off_increase",
        "filed_at": "2025-01-01T00:00:00+00:00",
    }
    base.update(kw)
    return base


def test_leading_signal_before_event_counts_as_predicted():
    signals = [
        _sig(signal_type="charge_off_increase", filed_at="2025-01-01T00:00:00+00:00", yoy_pct=42.0),
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00"),
    ]
    r = compute_backtest(signals)
    assert r["events_total"] == 1
    assert r["events_predicted"] == 1
    assert r["hit_rate"] == 1.0
    ev = r["events"][0]
    assert ev["predicted"] is True
    assert ev["lead_days"] == 151  # 2025-01-01 -> 2025-06-01
    assert ev["leading_type"] == "charge_off_increase"
    assert ev["leading_yoy_pct"] == 42.0


def test_signal_after_event_does_not_count():
    signals = [
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00"),
        # leading signal fires AFTER the sale — not predictive
        _sig(signal_type="charge_off_increase", filed_at="2025-07-01T00:00:00+00:00"),
    ]
    r = compute_backtest(signals)
    assert r["events_total"] == 1
    assert r["events_predicted"] == 0
    assert r["hit_rate"] == 0.0
    assert r["events"][0]["predicted"] is False


def test_signal_outside_window_does_not_count():
    signals = [
        _sig(signal_type="charge_off_increase", filed_at="2023-01-01T00:00:00+00:00"),
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00"),
    ]
    r = compute_backtest(signals, window_days=540)
    assert r["events_predicted"] == 0  # ~880 days apart > 540


def test_match_is_by_originator_not_global():
    signals = [
        # leading signal on a DIFFERENT originator must not predict ABC's sale
        _sig(cik="200", ticker="XYZ", signal_type="charge_off_increase", filed_at="2025-01-01T00:00:00+00:00"),
        _sig(cik="100", ticker="ABC", signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00"),
    ]
    r = compute_backtest(signals)
    assert r["events_predicted"] == 0


def test_earliest_qualifying_leading_signal_wins_for_max_lead():
    signals = [
        _sig(signal_type="charge_off_increase", filed_at="2025-01-01T00:00:00+00:00"),
        _sig(signal_type="npl_ratio_increase", filed_at="2025-04-01T00:00:00+00:00"),
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00"),
    ]
    r = compute_backtest(signals)
    ev = r["events"][0]
    assert ev["leading_type"] == "charge_off_increase"  # earliest = longest lead
    assert ev["lead_days"] == 151


def test_duplicate_same_day_events_deduped():
    signals = [
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00", source_id="a"),
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T12:00:00+00:00", source_id="b"),
    ]
    r = compute_backtest(signals)
    assert r["events_total"] == 1  # same originator, same day -> one event


def test_confirmed_vs_candidate_split():
    signals = [
        # a confirmed debt sale, flagged early
        _sig(signal_type="charge_off_increase", filed_at="2025-01-01T00:00:00+00:00"),
        _sig(signal_type="portfolio_sale_announced", filed_at="2025-06-01T00:00:00+00:00"),
        # a generic disposition on another originator, not flagged
        _sig(cik="200", ticker="XYZ", signal_type="divestiture_announced", filed_at="2025-06-01T00:00:00+00:00"),
    ]
    r = compute_backtest(signals)
    # Headline counts only the confirmed debt sale.
    assert r["confirmed_total"] == 1
    assert r["confirmed_predicted"] == 1
    assert r["hit_rate"] == 1.0
    # Generic disposition is tracked separately, never in the headline.
    assert r["candidate_total"] == 1
    assert r["candidate_predicted"] == 0
    assert r["events_total"] == 2


def test_generic_dispositions_do_not_inflate_headline():
    # 10 generic dispositions, none flagged, no confirmed sales -> hit_rate None.
    signals = [
        _sig(cik=str(i), ticker=f"T{i}", signal_type="divestiture_announced",
             filed_at="2025-06-01T00:00:00+00:00")
        for i in range(10)
    ]
    r = compute_backtest(signals)
    assert r["confirmed_total"] == 0
    assert r["hit_rate"] is None        # no confirmed sales -> no headline rate
    assert r["candidate_total"] == 10
    assert r["events_total"] == 10


def test_empty_signals_safe():
    r = compute_backtest([])
    assert r["events_total"] == 0
    assert r["confirmed_total"] == 0
    assert r["hit_rate"] is None
    assert r["events"] == []
