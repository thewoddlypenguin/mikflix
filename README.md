# Mikflix

Personal physical-media collection browser — a streaming-style front end over an owned library of discs (discgear cases, binders, drawers) and digital entitlements.

## Stack

- Vite + React 19 + TypeScript, react-router v7
- Local data pipeline: version-controlled CSV seeds → local SQLite (Python stdlib, no server)

## Setup

Requires Node 22+ and Python 3.11+ (for the data scripts).

```bash
npm install
npm run db:import    # build data/local/mikflix.db from data/seeds/ (first run)
npm run dev          # start the dev server
```

Other commands:

```bash
npm run build        # type-check + production build (dist/)
npm run preview      # preview the production build
npm run db:import    # re-import seeds; safe to re-run (updates in place)
npm run db:fresh     # delete the local DB and rebuild from seeds
```

## Data pipeline

Inventory lives in version-controlled seed CSVs under `data/seeds/` — never hard-coded in the UI, and the local database is never committed (`data/local/` is gitignored).

```bash
data/
  seeds/         # source of truth: raw inventory CSVs (committed)
  migrations/    # SQLite schema, applied in order (committed)
  scripts/       # import + maintenance scripts (committed)
  local/         # generated SQLite database (gitignored)
  reports/       # import reports and scratch output (gitignored)
```

`python data/scripts/import_seed.py` applies `data/migrations/` in order, then upserts the seed into `titles` (one row per catalog title) and `copies` (one row per physical or digital item). It is idempotent: rows are keyed by `(source_seed, source_row)`, so re-running an unchanged seed is a no-op, and any TMDb enrichment added later is preserved across re-imports.

The Batch-1 seed has some non-uniform rows (titles with unquoted commas, hand-captured binder/drawer/digital rows using a different column template). The importer normalizes these automatically and records every repair in the `import_runs` table — nothing is hand-edited in the CSV.

To import a new batch, drop the CSV in `data/seeds/` and run:

```bash
python data/scripts/import_seed.py --seed data/seeds/<file>.csv
```

## Environment

Copy `.env.example` to `.env` and fill in values if/when integrations are enabled (e.g. TMDb for artwork and metadata enrichment). `.env` is gitignored and never committed.

## Repository

GitHub: [thewoddlypenguin/mikflix](https://github.com/thewoddlypenguin/mikflix)
