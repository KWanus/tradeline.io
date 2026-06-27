"""Partner-API adapter — automated marketplace disposition feeds.

The dispositions worker already ingests (1) completed-sale news and (2) an
operator-maintained CSV. This module adds the third source the architecture
left a seam for: a direct **partner API** from a debt marketplace
(EverChain / Debexpert / NLEX / Garnet) that returns sold/closed listings as
JSON. Each listing becomes a confirmed disposition event for the backtest.

Design goals:
  * Config-driven — providers are declared in ONE env var so adding a feed is
    config, not code. Tokens live in their own env vars (never inline).
  * Provider-agnostic — a small field map translates any provider's JSON into
    our normalized disposition shape. Nested keys via dotted paths.
  * Safe by default — no config -> returns [] and the pipeline is unchanged.
    A bad/credential-less provider is logged and skipped, never fatal.

Config (env `TRADELINE_PARTNER_FEEDS`, a JSON array):

  [
    {
      "name": "EverChain",
      "url": "https://api.everchain.example/v1/closed-listings",
      "auth_env": "EVERCHAIN_TOKEN",          # env var holding the token
      "auth_header": "Authorization",          # default: Authorization
      "token_prefix": "Bearer ",               # default: "Bearer "
      "items_path": "data",                    # where the array lives ("" = root)
      "external_id": "id",                      # field used for dedupe
      "map": {                                  # normalized <- provider field
        "originator_name": "seller.name",
        "date": "closed_at",
        "ticker": "seller.ticker",
        "asset_class": "asset_type",
        "face_value_usd": "face_value",
        "url": "permalink"
      }
    }
  ]

Compliance: only feeds you are contractually entitled to (a partner API you
have credentials for). This is NOT a scraper for login-gated marketplace UIs.
No consumer data.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Callable

import requests

ENV_FEEDS = "TRADELINE_PARTNER_FEEDS"
HTTP_UA = "Tradeline radar (workers/partner_listings.py; hello@tradeline.io)"
HTTP_TIMEOUT = 45

# Required map keys (a provider with no seller name / date is unusable).
REQUIRED_MAP_FIELDS = ("originator_name", "date")


def _dig(obj: Any, path: str) -> Any:
    """Fetch a possibly-nested value by dotted path. 'seller.name' -> obj['seller']['name'].
    Returns None if any step is missing."""
    cur = obj
    for part in path.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def _norm_date(raw: Any) -> str:
    """Normalize a provider date/datetime to an ISO timestamp. Accepts
    'YYYY-MM-DD', full ISO, or a unix epoch (int/str)."""
    if raw is None or raw == "":
        return ""
    s = str(raw).strip()
    if s.isdigit() and len(s) >= 9:  # unix seconds
        try:
            return datetime.fromtimestamp(int(s), tz=timezone.utc).isoformat()
        except (ValueError, OSError):
            return ""
    if len(s) == 10:  # YYYY-MM-DD
        return f"{s}T00:00:00+00:00"
    return s  # assume already ISO-ish


def _hash(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


def load_feed_configs(raw_env: str | None) -> list[dict[str, Any]]:
    """Parse and validate the TRADELINE_PARTNER_FEEDS env JSON. Invalid or empty
    -> []. Each provider must have name, url, and required map fields."""
    if not raw_env or not raw_env.strip():
        return []
    try:
        feeds = json.loads(raw_env)
    except json.JSONDecodeError as e:
        print(f"[partner] {ENV_FEEDS} is not valid JSON: {e}")
        return []
    if not isinstance(feeds, list):
        print(f"[partner] {ENV_FEEDS} must be a JSON array")
        return []
    valid: list[dict[str, Any]] = []
    for f in feeds:
        if not isinstance(f, dict):
            continue
        if not f.get("name") or not f.get("url"):
            print("[partner] skipping feed with no name/url")
            continue
        fmap = f.get("map") or {}
        if not all(k in fmap for k in REQUIRED_MAP_FIELDS):
            print(f"[partner] {f.get('name')}: map missing {REQUIRED_MAP_FIELDS}")
            continue
        valid.append(f)
    return valid


def map_partner_items(
    items: list[dict[str, Any]], config: dict[str, Any]
) -> list[dict[str, Any]]:
    """Translate a provider's raw items into normalized disposition events.
    Pure — no network — so provider field maps are unit-testable with fixtures."""
    name = str(config.get("name") or "partner")
    fmap: dict[str, str] = config.get("map") or {}
    ext_key = config.get("external_id")
    out: list[dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue
        originator = _dig(item, fmap["originator_name"])
        date = _norm_date(_dig(item, fmap["date"]))
        if not originator or not date:
            continue

        def opt(field: str) -> str:
            if field not in fmap:
                return ""
            v = _dig(item, fmap[field])
            return "" if v is None else str(v).strip()

        ext_id = str(_dig(item, ext_key)) if ext_key else ""
        out.append(
            {
                "source": "disposition_partner",
                "source_id": _hash("partner", name.lower(), ext_id or f"{originator}|{date}"),
                "signal_type": "portfolio_sale_announced",
                "disposition_source": "partner_api",
                "marketplace": name,
                "ticker": opt("ticker").upper(),
                "cik": opt("cik"),
                "originator_name": str(originator).strip(),
                "asset_class": opt("asset_class"),
                "face_value_usd": opt("face_value_usd"),
                "confidence": 0.97,  # partner-verified transaction
                "filed_at": date,
                "url": opt("url"),
                "rationale": f"partner API listing from {name}",
            }
        )
    return out


def _token_for(config: dict[str, Any], getenv: Callable[[str], str | None]) -> str | None:
    auth_env = config.get("auth_env")
    if not auth_env:
        return None
    return getenv(auth_env)


def fetch_feed(
    config: dict[str, Any],
    sess: requests.Session,
    getenv: Callable[[str], str | None] = os.getenv,
) -> list[dict[str, Any]]:
    """Fetch + map one provider feed. Network/credential errors are non-fatal."""
    name = config.get("name")
    headers: dict[str, str] = {"User-Agent": HTTP_UA, "Accept": "application/json"}
    token = _token_for(config, getenv)
    if config.get("auth_env") and not token:
        print(f"[partner] {name}: {config['auth_env']} not set — skipping")
        return []
    if token:
        header = config.get("auth_header") or "Authorization"
        prefix = config.get("token_prefix", "Bearer ")
        headers[header] = f"{prefix}{token}"

    try:
        r = sess.get(config["url"], headers=headers, timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        payload = r.json()
    except (requests.RequestException, ValueError) as e:
        print(f"[partner] {name}: fetch failed ({e}) — skipping")
        return []

    items_path = config.get("items_path") or ""
    items = _dig(payload, items_path) if items_path else payload
    if not isinstance(items, list):
        print(f"[partner] {name}: items_path '{items_path}' did not resolve to a list")
        return []
    return map_partner_items(items, config)


def fetch_all(
    raw_env: str | None = None,
    sess: requests.Session | None = None,
    getenv: Callable[[str], str | None] = os.getenv,
) -> list[dict[str, Any]]:
    """Fetch every configured partner feed. No config -> []."""
    configs = load_feed_configs(raw_env if raw_env is not None else getenv(ENV_FEEDS))
    if not configs:
        return []
    s = sess or requests.Session()
    out: list[dict[str, Any]] = []
    for cfg in configs:
        events = fetch_feed(cfg, s, getenv)
        print(f"[partner] {cfg.get('name')}: {len(events)} listings")
        out.extend(events)
    return out
