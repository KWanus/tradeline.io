"""Tests for the buyer-side market-pricing computation."""

from __future__ import annotations

from workers.buyers import compute_pricing, _series_by_end, _median, extract_segments, _clean_segment


# Minimal XBRL instance: one consolidated + two segment members for both concepts.
_INSTANCE = """<?xml version="1.0"?>
<xbrl xmlns="http://x" xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:us-gaap="http://fasb.org/us-gaap/2024">
  <xbrli:context id="c_cons"><xbrli:period><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period></xbrli:context>
  <xbrli:context id="c_core"><xbrli:period><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
    <xbrli:segment><xbrldi:explicitMember dimension="us-gaap:FinancingReceivablePortfolioSegmentAxis">praa:CorePortfolioSegmentMember</xbrldi:explicitMember></xbrli:segment>
  </xbrli:context>
  <xbrli:context id="c_ins"><xbrli:period><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
    <xbrli:segment><xbrldi:explicitMember dimension="us-gaap:FinancingReceivablePortfolioSegmentAxis">praa:InsolvencyPortfolioSegmentMember</xbrldi:explicitMember></xbrli:segment>
  </xbrli:context>
  <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice contextRef="c_cons">220850000</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice>
  <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice contextRef="c_core">202950000</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice>
  <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice contextRef="c_ins">17900000</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice>
  <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue contextRef="c_cons">1677937000</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue>
  <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue contextRef="c_core">1587851000</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue>
  <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue contextRef="c_ins">90086000</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtParValue>
</xbrl>"""


def test_extract_segments_computes_per_segment_cents():
    segs = extract_segments(_INSTANCE)
    by = {s["segment"]: s for s in segs}
    assert set(by) == {"Core", "Insolvency"}
    assert by["Core"]["cents"] == 12.78        # 202,950 / 1,587,851
    assert by["Insolvency"]["cents"] == 19.87  # 17,900 / 90,086
    # Sorted by par size — Core (bigger pool) first.
    assert segs[0]["segment"] == "Core"


def test_extract_segments_empty_when_no_dimensions():
    consolidated_only = _INSTANCE.replace("c_core", "x1").replace("c_ins", "x2")
    # Remove the segment contexts entirely -> only consolidated remains.
    segs = extract_segments(
        """<?xml version="1.0"?><xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
        xmlns:us-gaap="http://fasb.org/us-gaap/2024">
        <xbrli:context id="c"><xbrli:period><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period></xbrli:context>
        <us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice contextRef="c">100</us-gaap:FinancingReceivablePurchasedWithCreditDeteriorationAmountAtPurchasePrice>
        </xbrl>"""
    )
    assert segs == []


def test_clean_segment_names():
    assert _clean_segment("CorePortfolioSegmentMember") == "Core"
    assert _clean_segment("InsolvencyPortfolioSegmentMember") == "Insolvency"


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
