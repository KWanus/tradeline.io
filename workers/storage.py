"""JSON file-backed storage so we can ship a working pipeline before paying for a DB.

Each entity type writes to its own JSONL file under data/output/. Append-only with
a (source, source_id) dedupe contract enforced on read. Swap for Postgres/Supabase
once paying customers exist (see docs/schema.sql).
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "data" / "output"


def _path(entity: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR / f"{entity}.jsonl"


def _existing_keys(entity: str, key_fields: tuple[str, ...]) -> set[tuple[str, ...]]:
    p = _path(entity)
    if not p.exists():
        return set()
    keys: set[tuple[str, ...]] = set()
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            keys.add(tuple(str(row.get(k, "")) for k in key_fields))
    return keys


def append(entity: str, rows: Iterable[dict[str, Any]], key_fields: tuple[str, ...]) -> int:
    """Append rows to entity store, deduping on key_fields. Returns count written."""
    seen = _existing_keys(entity, key_fields)
    written = 0
    p = _path(entity)
    now = int(time.time())
    with p.open("a", encoding="utf-8") as f:
        for row in rows:
            k = tuple(str(row.get(field, "")) for field in key_fields)
            if k in seen:
                continue
            seen.add(k)
            row.setdefault("_ingested_at_unix", now)
            f.write(json.dumps(row, default=str) + "\n")
            written += 1
    return written


def read_all(entity: str) -> list[dict[str, Any]]:
    p = _path(entity)
    if not p.exists():
        return []
    out: list[dict[str, Any]] = []
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def latest_n(entity: str, n: int, sort_key: str = "_ingested_at_unix") -> list[dict[str, Any]]:
    rows = read_all(entity)
    rows.sort(key=lambda r: r.get(sort_key, 0), reverse=True)
    return rows[:n]


# Helper: write a single "manifest" with the latest snapshot the web app can read fast
def write_snapshot(name: str, payload: Any) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    p = OUTPUT_DIR / f"{name}.json"
    p.write_text(json.dumps(payload, default=str, indent=2), encoding="utf-8")
