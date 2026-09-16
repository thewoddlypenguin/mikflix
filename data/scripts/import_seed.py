#!/usr/bin/env python3
"""Mikflix seed importer.

Builds the local SQLite database from version-controlled seed CSVs
(data/seeds/). Repeatable: copies are keyed by (source_seed, source_row)
so re-running the import with an unchanged seed updates in place, and
title enrichment (release_year, tmdb_*) is preserved across imports.

The Batch-1 CSV contains four row families, normalised on the fly:

  1. catalog rows       entry_id present, 24 clean fields.
  2. comma-split rows   an unquoted comma in the title split the row
                        across columns; repaired by merging (6 rows).
  3. manual rows        no entry_id, title duplicated in two columns
                        (binder/drawer/digital hand-captured rows);
                        repaired by dropping the duplicate (209 rows).
  4. missing-field rows manual rows whose disc_count was omitted,
                        shifting storage into the wrong column;
                        repaired by inserting the empty field (10 rows).

Usage:
  python data/scripts/import_seed.py [--db PATH] [--seed PATH] [--fresh]

Defaults:
  db:   data/local/mikflix.db        (gitignored)
  seed: data/seeds/inventory-batch-1.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sqlite3
import sys
from collections import Counter
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = REPO_ROOT / "data" / "local" / "mikflix.db"
DEFAULT_SEED = REPO_ROOT / "data" / "seeds" / "inventory-batch-1.csv"
MIGRATIONS_DIR = REPO_ROOT / "data" / "migrations"

COLUMNS = [
    "entry_id", "title_normalized", "title_display", "media_type", "franchise",
    "season_set", "part_volume", "disc_start", "disc_end", "disc_count",
    "storage_type", "container_name", "slot_start", "slot_end",
    "location_detail", "format", "label_raw", "title_match_status",
    "tmdb_id", "tmdb_media_type", "poster_path", "release_year",
    "match_confidence", "notes",
]
NCOLS = len(COLUMNS)

MEDIA_TYPES = {"movie", "tv", "music"}
STORAGE_TYPES = {"discgear", "binder", "drawer", "digital"}
MATCH_STATUSES = {"matched", "unmatched", "uncertain", "review"}
CONFIDENCES = {"high", "medium", "low", ""}
FORMATS = {"disc", "digital", "dvd", "blu-ray", "vhs", ""}


def slugify(text: str) -> str:
    text = text.lower().replace("'", "")
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or "untitled"


def normalise_row(row: list[str]) -> tuple[list[str], list[str]]:
    """Apply repair rules to one raw CSV row; returns (fields, repairs)."""
    repairs: list[str] = []
    fields = list(row)

    if fields and fields[0].strip():  # catalog row: entry_id present
        # Family 2 — comma-split title_display (the media_type column holds the title tail)
        if (
            len(fields) > 3
            and fields[2].strip()
            and fields[3].strip()
            and fields[3].strip().lower() not in MEDIA_TYPES
        ):
            merged = f"{fields[2].strip()}, {fields[3].strip()}"
            fields = [fields[0], fields[1], merged] + fields[4:]
            repairs.append("comma-split-title")
            # On these rows 'disc'/'format' and location_detail are also
            # transposed: location holds 'disc' while format is empty.
            li, fi = COLUMNS.index("location_detail"), COLUMNS.index("format")
            if len(fields) > fi and fields[li].strip().lower() in FORMATS and not fields[fi].strip():
                fields[fi] = fields[li].strip().lower()
                fields[li] = ""
                repairs.append("format-location-swap")
    elif len(fields) > 2 and not fields[0].strip() and not fields[1].strip() and fields[2].strip():
        # manual row
        # Family 3 — title duplicated in columns 2 and 3
        if len(fields) > 3 and fields[2].strip() == fields[3].strip():
            fields = fields[:3] + fields[4:]
            repairs.append("manual-dup-title")
        # Family 4 — a storage word sits in the disc_count column (a missing empty field)
        if len(fields) > 9 and fields[9].strip().lower() in STORAGE_TYPES:
            fields = fields[:9] + [""] + fields[9:]
            repairs.append("missing-disc-count")

    fields = (fields + [""] * NCOLS)[:NCOLS]
    fields = [f.strip() for f in fields]
    return fields, repairs


def parse_int(text: str) -> Optional[int]:
    text = (text or "").strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def load_seed(path: Path) -> tuple[list[dict], list[dict], str]:
    """Parse + normalise the seed. Returns (records, repairs, sha256)."""
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()

    reader = csv.reader(raw.decode("utf-8-sig").splitlines())
    try:
        next(reader)  # header
    except StopIteration:
        raise SystemExit(f"seed {path} is empty")

    records: list[dict] = []
    repairs: list[dict] = []
    anomalies: list[str] = []

    for row_num, row in enumerate(reader, start=2):
        if not any(f.strip() for f in row):
            continue
        fields, row_repairs = normalise_row(row)
        rec = dict(zip(COLUMNS, fields))
        rec["_row"] = row_num
        records.append(rec)

        for rep in row_repairs:
            repairs.append({"row": row_num, "repair": rep, "title": rec["title_display"]})

        problems = []
        if rec["media_type"].lower() not in MEDIA_TYPES:
            problems.append(f"media_type={rec['media_type']!r}")
        if rec["storage_type"].lower() not in STORAGE_TYPES:
            problems.append(f"storage_type={rec['storage_type']!r}")
        if rec["title_match_status"].lower() not in MATCH_STATUSES:
            problems.append(f"title_match_status={rec['title_match_status']!r}")
        if rec["match_confidence"].lower() not in CONFIDENCES:
            problems.append(f"match_confidence={rec['match_confidence']!r}")
        if rec["format"].lower() not in FORMATS:
            problems.append(f"format={rec['format']!r}")
        if not rec["title_display"]:
            problems.append("empty title_display")
        if problems:
            anomalies.append(f"row {row_num}: {'; '.join(problems)}")

    if anomalies:
        sys.stderr.write("ANOMALIES REMAIN AFTER REPAIRS:\n" + "\n".join(anomalies) + "\n")
        raise SystemExit(1)

    return records, repairs, sha


def run_migrations(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON")
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        conn.executescript(migration.read_text(encoding="utf-8"))


def import_records(conn: sqlite3.Connection, records: list[dict], seed_name: str) -> dict:
    cur = conn.cursor()
    titles_touched = set()

    for rec in records:
        title_id = rec["title_normalized"] or slugify(rec["title_display"])
        media_type = rec["media_type"].lower()
        match_status = rec["title_match_status"].lower() or "unmatched"
        confidence = rec["match_confidence"].lower() or None

        cur.execute(
            """
            INSERT INTO titles (id, display_title, media_type, franchise,
                                tmdb_media_type, match_status, match_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                display_title    = excluded.display_title,
                media_type       = excluded.media_type,
                franchise        = excluded.franchise,
                tmdb_media_type  = excluded.tmdb_media_type,
                match_status     = excluded.match_status,
                match_confidence = excluded.match_confidence,
                updated_at       = datetime('now')
            """,
            (title_id, rec["title_display"], media_type, rec["franchise"] or None,
             rec["tmdb_media_type"] or None, match_status, confidence),
        )
        titles_touched.add(title_id)

        entry_id = rec["entry_id"] or None
        fmt = rec["format"].lower() or None
        cur.execute(
            """
            INSERT INTO copies (
                title_id, entry_id, season_set, part_volume, disc_start, disc_end,
                disc_count, storage_type, container_name, slot_start, slot_end,
                location_detail, format, label_raw, match_status, match_confidence,
                notes, source_seed, source_row)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(source_seed, source_row) DO UPDATE SET
                title_id=excluded.title_id, entry_id=excluded.entry_id,
                season_set=excluded.season_set, part_volume=excluded.part_volume,
                disc_start=excluded.disc_start, disc_end=excluded.disc_end,
                disc_count=excluded.disc_count, storage_type=excluded.storage_type,
                container_name=excluded.container_name, slot_start=excluded.slot_start,
                slot_end=excluded.slot_end, location_detail=excluded.location_detail,
                format=excluded.format, label_raw=excluded.label_raw,
                match_status=excluded.match_status,
                match_confidence=excluded.match_confidence, notes=excluded.notes
            """,
            (title_id, entry_id, rec["season_set"] or None, rec["part_volume"] or None,
             parse_int(rec["disc_start"]), parse_int(rec["disc_end"]),
             parse_int(rec["disc_count"]), rec["storage_type"].lower(),
             rec["container_name"] or None, parse_int(rec["slot_start"]),
             parse_int(rec["slot_end"]), rec["location_detail"] or None, fmt,
             rec["label_raw"] or None,
             rec["title_match_status"].lower() or None, confidence,
             rec["notes"] or None, seed_name, rec["_row"]),
        )

    return {"titles_touched": len(titles_touched), "copies_written": len(records)}


def report(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    n_titles = cur.execute("SELECT COUNT(*) FROM titles").fetchone()[0]
    n_copies = cur.execute("SELECT COUNT(*) FROM copies").fetchone()[0]
    by_storage = cur.execute(
        "SELECT storage_type, COUNT(*) FROM copies GROUP BY 1 ORDER BY 2 DESC"
    ).fetchall()
    n_unmatched = cur.execute(
        "SELECT COUNT(*) FROM titles WHERE match_status = 'unmatched'"
    ).fetchone()[0]
    n_uncertain = cur.execute(
        "SELECT COUNT(*) FROM titles WHERE match_status IN ('uncertain', 'review')"
    ).fetchone()[0]
    multi = cur.execute(
        """SELECT COUNT(*) FROM (
             SELECT title_id FROM copies GROUP BY title_id HAVING COUNT(*) > 1)"""
    ).fetchone()[0]

    print(f"  titles:  {n_titles}  (unmatched: {n_unmatched}, uncertain/review: {n_uncertain})")
    print(f"  copies:  {n_copies}  (titles with multiple copies: {multi})")
    for storage, n in by_storage:
        print(f"    {storage:<10} {n}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import Mikflix seed CSV into local SQLite")
    ap.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite database path")
    ap.add_argument("--seed", type=Path, default=DEFAULT_SEED, help="seed CSV path")
    ap.add_argument("--fresh", action="store_true",
                    help="delete the database first and rebuild from scratch")
    args = ap.parse_args()

    if not args.seed.exists():
        raise SystemExit(f"seed not found: {args.seed}")

    if args.fresh and args.db.exists():
        args.db.unlink()

    args.db.parent.mkdir(parents=True, exist_ok=True)

    records, repairs, sha = load_seed(args.seed)
    print(f"seed: {args.seed.name}  ({len(records)} rows, sha256 {sha[:12]}…)")
    if repairs:
        stats = Counter(r["repair"] for r in repairs)
        print("repairs applied:", dict(stats))
    else:
        print("repairs applied: none")

    conn = sqlite3.connect(args.db)
    try:
        run_migrations(conn)
        result = import_records(conn, records, args.seed.name)
        conn.execute(
            """INSERT INTO import_runs (seed, seed_sha256, rows_read, rows_repaired,
                                        titles_written, copies_written, repairs)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (args.seed.name, sha, len(records), len(repairs),
             result["titles_touched"], result["copies_written"],
             json.dumps(repairs, ensure_ascii=False)),
        )
        conn.commit()
        print(f"imported into {args.db}")
        report(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
