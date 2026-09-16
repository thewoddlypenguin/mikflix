#!/usr/bin/env python3
"""Mikflix bundle exporter.

Reads data/local/mikflix.db and writes a JSON bundle for the frontend to
src/data/generated/titles.json. The bundle is generated output (never
hand-edited; regenerate via `npm run db:export` after any import), but it
IS committed so the static app ships with data without a build-time DB.

Bundle shape (versioned):
  {
    "schema": 1,
    "generated_at": "2026-09-15T10:00:00",
    "titles": [
      {
        "id", "display_title", "media_type", "franchise", "release_year",
        "match_status", "match_confidence",
        "copy_count", "formats": [...], "storage_types": [...],
        "season_sets": [...], "containers": [...],
        "copies": [
          {"entry_id", "season_set", "part_volume", "disc_start", "disc_end",
           "disc_count", "storage_type", "container_name", "slot_start",
           "slot_end", "location_detail", "format", "label_raw",
           "match_status", "match_confidence", "notes"}
        ]
      }, ...
    ]
  }

Usage:
  python data/scripts/export_bundle.py [--db PATH] [--out PATH]
"""

from __future__ import annotations

import argparse
import datetime
import json
import sqlite3
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = REPO_ROOT / "data" / "local" / "mikflix.db"
DEFAULT_OUT = REPO_ROOT / "src" / "data" / "generated" / "titles.json"

COPY_FIELDS = (
    "entry_id", "season_set", "part_volume", "disc_start", "disc_end",
    "disc_count", "storage_type", "container_name", "slot_start", "slot_end",
    "location_detail", "format", "label_raw", "match_status",
    "match_confidence", "notes",
)


def export(db_path: Path, out_path: Path) -> dict:
    if not db_path.exists():
        raise SystemExit(
            f"database not found: {db_path}\n"
            "run `npm run db:import` first to build the local database"
        )

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        titles = []
        for t in conn.execute(
            """SELECT id, display_title, media_type, franchise, release_year,
                      match_status, match_confidence
               FROM titles ORDER BY display_title COLLATE NOCASE"""
        ):
            copies = [
                {k: r[k] for k in COPY_FIELDS}
                for r in conn.execute(
                    """SELECT * FROM copies WHERE title_id = ? ORDER BY id""",
                    (t["id"],),
                )
            ]
            titles.append({
                "id": t["id"],
                "display_title": t["display_title"],
                "media_type": t["media_type"],
                "franchise": t["franchise"],
                "release_year": t["release_year"],
                "match_status": t["match_status"],
                "match_confidence": t["match_confidence"],
                "copy_count": len(copies),
                "formats": sorted({c["format"] for c in copies if c["format"]}),
                "storage_types": sorted({c["storage_type"] for c in copies if c["storage_type"]}),
                "season_sets": sorted({c["season_set"] for c in copies if c["season_set"]}),
                "containers": sorted({c["container_name"] for c in copies if c["container_name"]}),
                "copies": copies,
            })

        bundle = {
            "schema": 1,
            "generated_at": datetime.datetime.now(datetime.timezone.utc)
                .replace(microsecond=0).isoformat(),
            "titles": titles,
        }
    finally:
        conn.close()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)
        f.write("\n")

    return bundle


def main() -> None:
    ap = argparse.ArgumentParser(description="Export mikflix.db to frontend JSON bundle")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    bundle = export(args.db, args.out)
    n = len(bundle["titles"])
    n_copies = sum(t["copy_count"] for t in bundle["titles"])
    print(f"exported {n} titles / {n_copies} copies -> {args.out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
