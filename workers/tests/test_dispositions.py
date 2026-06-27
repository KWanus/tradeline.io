"""Tests for disposition ingestion (news classifier + manual listings)."""

from __future__ import annotations

from pathlib import Path

from workers.dispositions import classify_news_sales, load_manual_listings
from workers.tickers import Bank

BANKS = [
    Bank(ticker="COF", name="Capital One Financial", tier="card", asset_class_focus="credit-card", note="", cik="0000927628"),
    Bank(ticker="FITB", name="Fifth Third Bancorp", tier="regional", asset_class_focus="multi", note="", cik="0000035527"),
]


def _news(title, summary="", sid="1"):
    return {"source_id": sid, "title": title, "summary": summary, "link": "http://x", "published_at": "2025-04-01T00:00:00+00:00", "publisher": "PR"}


def test_completed_sale_headline_becomes_confirmed_event():
    news = [_news("Capital One completed the sale of a $500M credit card receivables portfolio")]
    out = classify_news_sales(news, BANKS)
    assert len(out) == 1
    ev = out[0]
    assert ev["signal_type"] == "portfolio_sale_announced"
    assert ev["ticker"] == "COF"
    assert ev["cik"] == "0000927628"
    assert ev["asset_class"] == "credit_card"
    assert ev["confidence"] >= 0.8


def test_chatter_without_sale_verb_is_ignored():
    news = [_news("Capital One credit card charge-offs rose in Q1")]
    assert classify_news_sales(news, BANKS) == []


def test_non_debt_disposition_is_ignored():
    # "sold" present, but it's a building, and a negative-context word is set.
    news = [_news("Fifth Third sold its downtown headquarters building")]
    assert classify_news_sales(news, BANKS) == []


def test_speculation_is_ignored():
    news = [_news("Fifth Third may sell a loan portfolio, sources say")]
    # "may sell" is negative context -> not a confirmed event.
    assert classify_news_sales(news, BANKS) == []


def test_unmatched_originator_is_ignored():
    news = [_news("Some Other Bank completed the sale of a loan portfolio")]
    assert classify_news_sales(news, BANKS) == []


def test_manual_listings_skips_comments(tmp_path: Path):
    csv = tmp_path / "listings.csv"
    csv.write_text(
        "date,originator_name,ticker,cik,asset_class,face_value_usd,marketplace,url,note\n"
        "# this is a comment\n"
        "# 2026-01-01,Commented Example,,,auto,,EverChain,,should be skipped\n"
        "2026-02-14,Real Community Bank,FDIC-12345,,auto,2500000,EverChain,,seen live\n",
        encoding="utf-8",
    )
    out = load_manual_listings(csv)
    assert len(out) == 1
    ev = out[0]
    assert ev["originator_name"] == "Real Community Bank"
    assert ev["ticker"] == "FDIC-12345"
    assert ev["signal_type"] == "portfolio_sale_announced"
    assert ev["marketplace"] == "EverChain"
    assert ev["confidence"] == 0.95
