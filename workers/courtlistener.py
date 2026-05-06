"""CourtListener worker — surface court opinions and federal-court searches
relevant to the debt-buying market: FDCPA litigation against buyers, NPL
portfolio sale disputes, regulator actions.

Why this matters: licensed buyers track who's getting sued and on what theory.
A spike in FDCPA class actions against a specific buyer or under a specific
collection method is a real market signal — it changes what kinds of paper
are safe to acquire and what compliance moats matter.

Source: https://www.courtlistener.com/api/rest/v4/search/ (free, no key needed
for the search endpoint at the volumes we use). Authenticated endpoints offer
docket-level data — wire that in once a Phase-2 customer asks for it.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import requests

from workers import storage

CL_SEARCH_URL = "https://www.courtlistener.com/api/rest/v4/search/"
CL_USER_AGENT = "Tradeline workers kwanusmrket@gmail.com"

# Each query gets stamped onto its hits. Ordered most-specific first.
QUERIES: tuple[tuple[str, str, str], ...] = (
    ("npl_portfolio_sale", '"non-performing loan" portfolio sale', "o"),  # opinions
    ("debt_buyer_fdcpa", '"debt buyer" "FDCPA"', "o"),
    ("charge_off_lawsuit", '"charge-off" debt collection lawsuit', "o"),
    ("portfolio_sale_dispute", '"portfolio sale" debt buyer', "o"),
    ("regulator_cfpb", "CFPB enforcement debt collector", "o"),
    ("medical_debt_litigation", '"medical debt" buyer lawsuit', "o"),
    ("fdcpa_class_action", '"FDCPA" class action 2025', "o"),
)


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": CL_USER_AGENT, "Accept": "application/json"})
    return s


def _hit_to_row(label: str, hit: dict) -> dict[str, Any]:
    return {
        "source": "courtlistener",
        "source_id": str(hit.get("cluster_id") or hit.get("id") or hit.get("absolute_url") or ""),
        "query_label": label,
        "case_name": hit.get("caseName") or hit.get("case_name") or "",
        "court": hit.get("court") or "",
        "court_short": hit.get("court_citation_string") or "",
        "date_filed": hit.get("dateFiled") or hit.get("date_filed") or "",
        "snippet": (hit.get("snippet") or "")[:1000],
        "absolute_url": (
            "https://www.courtlistener.com" + hit["absolute_url"]
            if isinstance(hit.get("absolute_url"), str)
            else hit.get("absolute_url", "")
        ),
        "cite_count": hit.get("citeCount", 0) or 0,
    }


def fetch_query(label: str, q: str, type_code: str, sess: requests.Session) -> list[dict[str, Any]]:
    params = {"q": q, "type": type_code, "order_by": "dateFiled desc"}
    r = sess.get(CL_SEARCH_URL, params=params, timeout=30)
    if r.status_code == 429:
        # Rate-limited — backoff and skip; not fatal for this run.
        print(f"[courtlistener] {label}: 429 rate-limited, skipping")
        return []
    if not r.ok:
        print(f"[courtlistener] {label}: HTTP {r.status_code}")
        return []
    body = r.json()
    return [_hit_to_row(label, h) for h in (body.get("results") or [])[:20]]


def run() -> dict[str, int]:
    sess = _session()
    all_rows: list[dict[str, Any]] = []
    print(f"[courtlistener] running {len(QUERIES)} queries")
    for label, q, type_code in QUERIES:
        try:
            rows = fetch_query(label, q, type_code, sess)
        except Exception as e:
            print(f"[courtlistener] {label} failed: {e}")
            rows = []
        print(f"[courtlistener] {label}: {len(rows)} hits")
        all_rows.extend(rows)
        time.sleep(1.0)  # be polite — CourtListener is a non-profit
    written = storage.append("court_signals", all_rows, key_fields=("source", "source_id"))
    return {
        "queries": len(QUERIES),
        "seen": len(all_rows),
        "new": written,
        "snapshot_time": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    print(f"[courtlistener] done: {run()}")
