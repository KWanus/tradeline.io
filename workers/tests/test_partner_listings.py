"""Tests for the partner-API disposition adapter (no network)."""

from __future__ import annotations

import json

from workers import partner_listings as pl

CONFIG = {
    "name": "EverChain",
    "url": "https://api.everchain.example/v1/closed",
    "auth_env": "EVERCHAIN_TOKEN",
    "items_path": "data",
    "external_id": "id",
    "map": {
        "originator_name": "seller.name",
        "date": "closed_at",
        "ticker": "seller.ticker",
        "asset_class": "asset_type",
        "face_value_usd": "face_value",
        "url": "permalink",
    },
}


def test_map_partner_items_translates_nested_fields():
    items = [
        {
            "id": "L-1",
            "seller": {"name": "Acme Community Bank", "ticker": "acb"},
            "closed_at": "2026-03-15",
            "asset_type": "auto",
            "face_value": 2500000,
            "permalink": "https://x/L-1",
        }
    ]
    out = pl.map_partner_items(items, CONFIG)
    assert len(out) == 1
    e = out[0]
    assert e["originator_name"] == "Acme Community Bank"
    assert e["ticker"] == "ACB"
    assert e["asset_class"] == "auto"
    assert e["filed_at"] == "2026-03-15T00:00:00+00:00"
    assert e["signal_type"] == "portfolio_sale_announced"
    assert e["disposition_source"] == "partner_api"
    assert e["marketplace"] == "EverChain"
    assert e["confidence"] == 0.97


def test_map_skips_items_missing_required_fields():
    items = [{"id": "L-2", "seller": {"name": "No Date Bank"}}]  # no closed_at
    assert pl.map_partner_items(items, CONFIG) == []


def test_unix_epoch_date_normalized():
    items = [{"id": "L-3", "seller": {"name": "Epoch Bank"}, "closed_at": 1773532800}]
    cfg = {**CONFIG, "map": {"originator_name": "seller.name", "date": "closed_at"}}
    out = pl.map_partner_items(items, cfg)
    assert out and out[0]["filed_at"].startswith("2026-")


def test_external_id_makes_source_id_stable():
    items = [{"id": "L-9", "seller": {"name": "X"}, "closed_at": "2026-01-01"}]
    a = pl.map_partner_items(items, CONFIG)[0]["source_id"]
    b = pl.map_partner_items(items, CONFIG)[0]["source_id"]
    assert a == b


def test_load_feed_configs_validates():
    assert pl.load_feed_configs(None) == []
    assert pl.load_feed_configs("") == []
    assert pl.load_feed_configs("not json") == []
    assert pl.load_feed_configs(json.dumps({"not": "a list"})) == []
    # missing required map field -> dropped
    bad = json.dumps([{"name": "P", "url": "http://x", "map": {"date": "d"}}])
    assert pl.load_feed_configs(bad) == []
    good = json.dumps([CONFIG])
    assert len(pl.load_feed_configs(good)) == 1


def test_fetch_all_noop_without_config():
    assert pl.fetch_all(getenv=lambda k: None) == []


class _FakeResp:
    def __init__(self, payload):
        self._p = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._p


class _FakeSession:
    def __init__(self, payload):
        self._p = payload
        self.last_headers = None

    def get(self, url, headers=None, timeout=None):
        self.last_headers = headers
        return _FakeResp(self._p)


def test_fetch_feed_uses_token_and_maps():
    payload = {
        "data": [
            {"id": "L-1", "seller": {"name": "Bank A", "ticker": "BA"}, "closed_at": "2026-02-02"}
        ]
    }
    sess = _FakeSession(payload)
    env = {"EVERCHAIN_TOKEN": "secret123"}
    out = pl.fetch_feed(CONFIG, sess, getenv=env.get)
    assert len(out) == 1
    assert out[0]["originator_name"] == "Bank A"
    assert sess.last_headers["Authorization"] == "Bearer secret123"


def test_fetch_feed_skips_when_token_missing():
    sess = _FakeSession({"data": []})
    out = pl.fetch_feed(CONFIG, sess, getenv=lambda k: None)
    assert out == []
