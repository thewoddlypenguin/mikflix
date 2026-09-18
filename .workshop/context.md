# Project: Mikflix (My Movie Database)

Personal physical-media collection browser ("Mikflix"). Phase: full real-data app (632 titles) with TMDb imagery + local data pipeline.

## Stack & Conventions
- Vite 6 + React 19 + TypeScript strict (noUnusedLocals/Parameters) + react-router v7 (`react-router`)
- Deps: motion, lucide-react, dotenv (for enrich script). Node 22 / npm 10, Windows shell (no `tail`; use `findstr`)
- Run: `start.bat` / `start.sh` (uses $APP_PORT, dev server ~3035) · Build: `npm run build` = `generate && enrich && tsc -b && vite build` · Data: `npm run generate` (CSV→titles.json), `npm run enrich` (TMDb), `db:import`/`db:fresh`/`db:export` (SQLite pipeline, superseded by CSV+enrich flow for frontend)
- vite `base: '/'` (absolute) — required for SPA deep-link refresh under nginx `try_files $uri $uri/ /index.html`; favicon `/mikflix.svg`

## Data Flow (current)
- Source: `src/data/digital-inventory-batch-1.csv` (644 rows) → `scripts/generate-titles.mjs` → `src/data/generated/titles.json` + mirrored `public/titles.json` (schema 1.2.0, 632 titles / 644 copies)
- `scripts/enrich-tmdb.mjs`: TMDb search+details, cache at `scripts/tmdb-cache.json` (committed, 1134 entries, covers 585 titles; 42 un-enriched; 5 music skipped). Works OFFLINE from cache when no .env; only hits API for uncached titles. NEVER log credential values.
- Frontend loads at runtime: `fetchTitles()` in `src/lib/data-adapter.ts` (fetch /titles.json → MediaTitle[]). ALL screens use it (Home, Library, TitleDetail, Wishlist, Admin, Inventory). mock.ts remains but has zero importers.
- Adapter maps: poster_path→posterUrl (w500), backdrop_path→backdropUrl (w1280), art_seed/art_hue/art_motif→procedural fallback art, movie→film, storage discgear→shelf. Enrichment fields (overview, genres, vote_average) exist in bundle but are NOT yet mapped — adapter still emits genres:[], rating:'NR', synopsis:'No synopsis available.'
- Enrichment writes title-level match_status='unmatched' for ALL titles (upstream data quirk) — copy-level too. Admin review queue + uncertain badges therefore show nothing.

## UI Notes
- `Poster` component: renders TMDb `<img>` when posterUrl given (onError → falls back to procedural canvas; effect deps include showImage so fallback redraws). `wide` prop for 16:9 hero backdrops. Canvas colors MUST use hsla helpers.
- Home hero: data-safe pick (featuredTitleId if exists, else most-copies title); no non-null assertions on real data.
- Home category rows: `categories.ts` titleIds are still MOCK ids (zero exist in real bundle) → rows render nothing. Need repopulating with real ids.
- Wishlist: real bundle has no wishlist entries → renders empty state (correct).
- URL-synced filters: Library (`?q=&type=&genre=&format=&storage=&container=&flag=&view=&sort=`, presets via `?preset=`), Inventory (`?q=&type=&format=&sort=`).

## Git / Deployment
- Remote `origin` = github.com/thewoddlypenguin/mikflix. USER DRIVES ALL REMOTE OPS — never run git push/pull unless user explicitly asks; commit locally, hand over copy-paste instructions.
- Branch: main. Token (keyring service `workshop`, key GITHU1_GITHUB_TOKEN) is git-transport only (API 401); never echo token/remote URL.
- `.env` gitignored (NOT in repo; enrich runs offline-from-cache without it); `.env.example` has placeholders (TMDB_API_KEY, TMDB_READ_TOKEN, MIKFLIX_API_URL)
- Windows quirks: use `uv`/npm via cmd; subprocess capture needs utf-8 decode with errors='replace' (cp1252 crashes on emoji); multiline `python -c` fails; terminal output garbled — prefer execute tool subprocess or findstr
- NEVER build with `generate` unless you mean it: it overwrites the enriched titles.json with un-enriched output; enrich then re-applies from cache. If a build fails after generate, `git checkout HEAD -- src/data/generated/titles.json public/titles.json` to restore.