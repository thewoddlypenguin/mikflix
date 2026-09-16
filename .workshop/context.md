# Project: Mikflix (My Movie Database)

Personal physical-media collection browser ("Mikflix"). Phase: front-end app shell (mock data) + local data pipeline (CSV seeds → SQLite).

## Stack & Conventions
- Vite + React 19 + TypeScript + react-router v7 (library package: `react-router`, imports from `react-router`)
- Deps: motion, lucide-react. Node 22 / npm 10, Windows shell (no `tail`; use `findstr`)
- Run: `start.bat` / `start.sh` (uses $APP_PORT) · Build: `npm run build` (tsc -b + vite)
- tsconfig is strict with noUnusedLocals/Parameters — unused imports fail the build
- Data scripts: Python 3.11+ stdlib only (csv, sqlite3, hashlib) — run via `python data/scripts/import_seed.py` or `npm run db:import` / `npm run db:fresh`

## Data Pipeline (Batch 1)
- `data/seeds/inventory-batch-1.csv` — version-controlled seed (572 rows, NOT 52; 517 titles, 572 copies)
- `data/migrations/0001_init.sql` — SQLite schema: titles / copies / import_runs
- `data/scripts/import_seed.py` — idempotent importer keyed by (source_seed, source_row); preserves enrichment across re-imports
- `data/local/` (gitignored) — generated mikflix.db; `src/data/generated/` (gitignored) — future exported JSON bundle
- CSV row families normalized on the fly: comma-split titles (6), manual dup-title rows (209), missing disc_count (10), format/location swap (6); all repairs logged in import_runs table
- Data quality: 316 unmatched titles, 12 uncertain + 1 review, 0 TMDb enrichment fields populated, 2 slot double-bookings (Container B slot 48, Container E slot 21), 18 catalog+manual merged duplicates (legit second copies)

## Architecture
- `src/data/` — types.ts (flat MediaTitle/MediaCopy/WishlistEntry; future schema splits title/edition/copy/wishlist), mock.ts (20 titles), categories.ts (home rows + smart list hrefs)
- `src/lib/` — summaries.ts (denormalized TitleSummary cards), collection.ts (filters/sort/flags), format.ts
- `src/components/{ui,collection,library,layout}/` with per-component CSS + barrel index.ts
- `src/screens/` — Home, Library, TitleDetail, Wishlist, Admin, NotFound; screen CSS beside each
- Library filters fully URL-synced (`?q=&type=&genre=&format=&storage=&container=&flag=&view=&sort=`); presets via `?preset=`

## Design System ("warm midnight projection booth")
- Tokens in `src/styles/theme.css`: espresso bg, gold=owned, teal=wanted/wishlist, ember=lost, lilac=uncertain-match
- Fonts: Fraunces (display), Karla (UI), IBM Plex Mono (locations/labels) via Google Fonts in index.html
- Posters are PROCEDURAL: `<Poster seed hue motif>` canvas art (motifs: ring/arch/horizon/emblem/mono) — no image assets. Canvas colors MUST use `hsla(h,s%,l%,a)` helpers (appended hex alpha to hsl() throws SyntaxError)
- Badge tones carry product meaning; reuse titleBadges()/wishlistBadge() from ui/Badge

## Verified Behaviors
- hasLooseDiscOnly = binder/loose disc present AND no cased copy (box/keep-case/slip)
- "recently-added" flag = recencyRank(id) !== 99; "disney" flag = franchise === 'Disney Animated'
- All Home category titleIds must exist in mock.ts
- Import verified: 572 rows → 517 titles, 0 anomalies post-repair, re-run is a no-op (572 copies stable)

## Git / Deployment
- Remote `origin` = github.com/thewoddlypenguin/mikflix (HTTPS, token from connector secret GITHU1_GITHUB_TOKEN, keyring service `workshop` — NOT `memex`)
- Branch: `main` (3 commits, not yet pushed — user will push when ready; data-pipeline changes staged for review, NOT committed)
- Do NOT push unless explicitly asked; never echo/print the token or remote URL
- Token fine-grained perms cover git ops only (API returns 401) — use `git ls-remote` to test auth
- User will handle GitHub Pages/static hosting themselves; keep `base: './'` in vite.config
- `.env` gitignored; `.env.example` holds placeholders only (TMDB_API_KEY, TMDB_READ_TOKEN, MIKFLIX_API_URL)