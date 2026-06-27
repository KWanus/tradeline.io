"""Regression tests for the local-geography enrichment on Call Report signals.

These guard the city/county fields the web app's location filter depends on —
if a future refactor drops them, the "find local sellers" feature silently
breaks. Pure-function tests over score(); no network.
"""

from __future__ import annotations

from workers import fdic, ncua


def test_fdic_signal_carries_city_and_county():
    latest = {
        "CERT": "12345",
        "NAME": "TEST COMMUNITY BANK",
        "STALP": "VA",
        "REPDTE": "20260331",
        "ASSET": 500_000,
        "NCLNLS": 1_000,      # noncurrent loans ($thousands), above the floor
        "NTLNLSQ": 1_000,     # net charge-offs this quarter
        "NTCRCD": 600,        # credit-card slice of charge-offs
    }
    prior = {"CERT": "12345", "NCLNLS": 500, "NTLNLSQ": 100}
    geo = {"12345": {"city": "Roanoke", "county": "Roanoke"}}

    signals = fdic.score(latest, prior, geo)

    assert signals, "expected at least one signal"
    for s in signals:
        assert s["state"] == "VA"
        assert s["city"] == "Roanoke"
        assert s["county"] == "Roanoke"


def test_fdic_missing_geo_is_non_fatal():
    latest = {
        "CERT": "999",
        "NAME": "NO GEO BANK",
        "STALP": "NC",
        "REPDTE": "20260331",
        "ASSET": 300_000,
        "NCLNLS": 1_000,
        "NTLNLSQ": 1_000,
    }
    prior = {"CERT": "999", "NCLNLS": 500, "NTLNLSQ": 100}

    # geo=None must not raise and must yield empty (not missing) city/county.
    signals = fdic.score(latest, prior, None)
    assert signals
    assert signals[0]["city"] == ""
    assert signals[0]["county"] == ""


def test_ncua_signal_carries_titlecased_city():
    header = ["Acct_010", "Acct_550", "Acct_551", "Acct_041B"]
    latest = {
        "CU_NAME": "TEST FEDERAL CREDIT UNION",
        "STATE": "TX",
        "CITY": "TEXARKANA",       # NCUA ships upper-case; we title-case it
        "Acct_010": "1000000",
        "Acct_550": "500000",      # charge-offs YTD
        "Acct_551": "0",           # recoveries YTD
        "Acct_041B": "800000",     # delinquent loans
    }
    prior = {"Acct_550": "100000", "Acct_551": "0", "Acct_041B": "100000"}

    signals = ncua.score("4242", latest, prior, header, "2026", "03")

    assert signals, "expected at least one signal"
    for s in signals:
        assert s["state"] == "TX"
        assert s["city"] == "Texarkana"
        assert s["county"] == ""   # NCUA reports county only as a numeric code
        assert s["tier"] == "credit-union"
