-- Mikflix schema, migration 0001
-- Local SQLite database rebuilt from version-controlled seeds (data/seeds/).
-- Nothing in data/local/ is committed; re-run `npm run db:import` to rebuild.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- titles: one row per catalog title (the thing you'd look up)
-- Copies (physical/disc groups) live in `copies` and reference titles.
-- Enrichment columns (release_year, tmdb_*) are filled by a later TMDb pass;
-- they start NULL for Batch 1 and are preserved across re-imports.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS titles (
  id               TEXT PRIMARY KEY,          -- slug: title_normalized, or derived from display title
  display_title    TEXT NOT NULL,
  media_type       TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'music')),
  franchise        TEXT,
  release_year     INTEGER,
  tmdb_id          INTEGER,
  tmdb_media_type  TEXT,
  poster_path      TEXT,
  match_status     TEXT NOT NULL DEFAULT 'unmatched'
                   CHECK (match_status IN ('matched', 'unmatched', 'uncertain', 'review')),
  match_confidence TEXT CHECK (match_confidence IN ('high', 'medium', 'low')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- copies: one row per inventory record (a disc group, binder disc, drawer
-- set, or digital entitlement). season/part info is per copy because the
-- same title can exist as several editions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS copies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id         TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  entry_id         TEXT UNIQUE,               -- catalog id like 'C-030-035'; NULL for manual entries
  season_set       TEXT,                      -- 'Season 2', 'Complete Series', 'Movies', ...
  part_volume      TEXT,
  disc_start       INTEGER,
  disc_end         INTEGER,
  disc_count       INTEGER,
  storage_type     TEXT NOT NULL CHECK (storage_type IN ('discgear', 'binder', 'drawer', 'digital')),
  container_name   TEXT,                      -- 'Container C', 'Binder 1', 'Drawer', 'Fandango at Home'
  slot_start       INTEGER,
  slot_end         INTEGER,
  location_detail  TEXT,                      -- 'drawer', 'handwritten disc', 'digital library', ...
  format           TEXT CHECK (format IN ('disc', 'digital', 'dvd', 'blu-ray', 'vhs')),
  label_raw        TEXT,                      -- text as written/OCR'd on the item
  match_status     TEXT CHECK (match_status IN ('matched', 'unmatched', 'uncertain', 'review')),
  match_confidence TEXT CHECK (match_confidence IN ('high', 'medium', 'low')),
  notes            TEXT,
  source_seed      TEXT NOT NULL,             -- seed file this row came from
  source_row       INTEGER NOT NULL,          -- record number in the seed CSV (traceability)
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_seed, source_row)
);

CREATE INDEX IF NOT EXISTS idx_copies_title   ON copies(title_id);
CREATE INDEX IF NOT EXISTS idx_copies_storage ON copies(storage_type);
CREATE INDEX IF NOT EXISTS idx_titles_match   ON titles(match_status);

-- ---------------------------------------------------------------------------
-- import_runs: audit log of seed imports (seed checksum, counts, repairs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  seed            TEXT NOT NULL,
  seed_sha256     TEXT NOT NULL,
  imported_at     TEXT NOT NULL DEFAULT (datetime('now')),
  rows_read       INTEGER NOT NULL,
  rows_repaired   INTEGER NOT NULL,
  titles_written  INTEGER NOT NULL,
  copies_written  INTEGER NOT NULL,
  repairs         TEXT NOT NULL DEFAULT '[]'  -- JSON: [{row, repair}, ...]
);
