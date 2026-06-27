"""Disposition proxy — infer "the bad book moved" from public balance sheets.

The marketplaces hold the only *confirmed* record of a charge-off sale, behind
partner agreements. SEC full-text search confirms these sales are not disclosed
in public filings. So for institutions with no public sale announcement, there
is no way to *confirm* a sale from public data.

There is, however, a public *proxy*: when an institution we flagged for rising
charge-offs / noncurrent loans then shows its noncurrent-loan balance drop
sharply in the next FDIC Call Report, the distressed book left the balance
sheet — they either sold it or wrote it off. We can't tell which from the
Call Report alone, so we label it honestly as a proxy (NOT a confirmed sale)
and feed it to the backtest as a candidate-tier event.

This needs no partner, no scraping, no permission — only the FDIC financials
API we already use.

Output: appends `balance_cleared_proxy` events to the `dispositions` stream.
"""

from __future__ import annotations

from typing import Any

from workers import fdic, storage

# A noncurrent-loan balance drop this large QoQ, off a material base, after a
# flag, is consistent with the institution clearing its distressed book.
DROP_THRESHOLD_PCT = 35.0
# Minimum prior-quarter noncurrent balance ($thousands) to bother — ignore
# tiny books whose swings are noise. $2M.
NCL_FLOOR = 2_000


def _prior_quarter(repdte: str) -> str:
    """'20260331' -> '20251231' (previous quarter-end, correct quarter-end day)."""
    year, mm = int(repdte[:4]), repdte[4:6]
    # mm -> (prior MMDD, year delta). Quarter-ends: 0331, 0630, 0930, 1231.
    step = {"03": ("1231", -1), "06": ("0331", 0), "09": ("0630", 0), "12": ("0930", 0)}
    mmdd, dy = step.get(mm, ("1231", -1))
    return f"{year + dy}{mmdd}"


def detect_clears(
    flagged: dict[str, dict[str, Any]],
    latest_ncl: dict[str, float],
    prior_ncl: dict[str, float],
    repdte: str,
    drop_threshold: float = DROP_THRESHOLD_PCT,
    floor: float = NCL_FLOOR,
) -> list[dict[str, Any]]:
    """Pure: emit a proxy event for each flagged cert whose noncurrent balance
    dropped >= threshold QoQ off a base above `floor`. Unit-testable."""
    out: list[dict[str, Any]] = []
    for cert, meta in flagged.items():
        prior = prior_ncl.get(cert, 0.0)
        latest = latest_ncl.get(cert, 0.0)
        if prior < floor:
            continue
        drop_pct = (prior - latest) / prior * 100.0
        if drop_pct < drop_threshold:
            continue
        out.append(
            {
                "source": "disposition_proxy",
                "source_id": f"{cert}:cleared:{repdte}",
                "signal_type": "balance_cleared_proxy",
                "disposition_source": "call_report_proxy",
                "marketplace": "",
                "cert": cert,
                "ticker": f"FDIC-{cert}",
                "originator_name": meta.get("originator_name") or f"FDIC #{cert}",
                "state": meta.get("state") or "",
                "asset_class": "",
                # Proxy, not confirmed: could be a sale or an internal write-off.
                "confidence": 0.5,
                "filed_at": f"{repdte[:4]}-{repdte[4:6]}-{repdte[6:8]}T00:00:00+00:00",
                "noncurrent_prior": prior,
                "noncurrent_latest": latest,
                "drop_pct": round(drop_pct, 1),
                "url": fdic.BANKFIND_DETAIL.format(cert=cert),
                "rationale": (
                    f"noncurrent loans fell {drop_pct:.0f}% QoQ after a flag — "
                    f"distressed book cleared (sold or written off)"
                ),
            }
        )
    return out


def run() -> dict[str, Any]:
    # Institutions we previously flagged (FDIC), keyed by cert.
    flagged: dict[str, dict[str, Any]] = {}
    for s in storage.read_all("fdic_signals"):
        cert = str(s.get("cert") or "")
        if cert:
            flagged.setdefault(
                cert,
                {"originator_name": s.get("originator_name"), "state": s.get("state")},
            )
    if not flagged:
        print("[disp_proxy] no FDIC flags yet — nothing to check")
        return {"flagged": 0, "events_new": 0}

    sess = fdic._session()
    latest_repdte = fdic._latest_repdte(sess)
    if not latest_repdte:
        return {"flagged": len(flagged), "events_new": 0}
    prior_repdte = _prior_quarter(latest_repdte)

    def _ncl_by_cert(repdte: str) -> dict[str, float]:
        rows = fdic._fetch_financials(repdte, sess)
        return {str(r.get("CERT")): fdic._num(r, "NCLNLS") for r in rows if r.get("CERT")}

    latest_ncl = _ncl_by_cert(latest_repdte)
    prior_ncl = _ncl_by_cert(prior_repdte)

    events = detect_clears(flagged, latest_ncl, prior_ncl, latest_repdte)
    written = storage.append("dispositions", events, key_fields=("source", "source_id"))
    print(
        f"[disp_proxy] flagged={len(flagged)} latest={latest_repdte} "
        f"prior={prior_repdte} cleared={len(events)} new={written}"
    )
    return {
        "flagged": len(flagged),
        "cleared_proxies": len(events),
        "events_new": written,
        "latest_repdte": latest_repdte,
    }


if __name__ == "__main__":
    print(f"[disp_proxy] done: {run()}")
