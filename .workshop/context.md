# Project: Mikflix (My Movie Database)

Personal physical-media collection browser ("Mikflix"). Phase: full real-data app (632 titles) with TMDb imagery, local data pipeline, and admin workflows (password gate + full CRUD).

## Stack & Conventions
- Vite 6 + React 19 + TypeScript strict (noUnusedLocals/Parameters) + react-router v7 (`react-router`)
- Deps: motion, lucide-react, dotenv (for enrich script). Node 22 / npm 10, Windows shell (no `tail`; use `findstr`; no heredocs in cmd — write commit messages to a temp file and `git commit -F <file>`)
- Run: `start.bat` / `start.sh` (uses $APP_PORT, dev server ~3035) · Build: `npm run build` = `generate && enrich && tsc -b && vite build` · Data: `npm run generate` (CSV→titles.json), `npm run enrich` (TMDb), `npm run admin:api` (standalone API, port 4545)
- vite `base: '/'` (absolute) — required for SPA deep-link refresh under nginx `try_files $uri $uri/ /index.html`; favicon `/mikflix.svg`

## Data Flow (current)
- Source: `src/data/digital-inventory-batch-1.csv` (644 rows) → `scripts/generate-titles.mjs` → `src/data/generated/titles.json` + mirrored `public/titles.json` (schema 1.2.0, 632 titles)
- `scripts/enrich-tmdb.mjs`: TMDb search+details, cache at `scripts/tmdb-cache.json` (committed). Works OFFLINE from cache when no .env. NEVER log credential values.
- **Admin overrides sidecar `data/admin/overrides.json`** `{ patches: {id: fields}, added: [titles], deletedIds: [ids] }`:
  - Written by `scripts/admin-api.mjs` (full CRUD: GET/POST/PUT/DELETE /api/title + manual-image endpoints; field whitelists EDITABLE_TITLE_FIELDS/EDITABLE_COPY_FIELDS; recomputeDenorm mirrors generate)
  - Re-applied by generate-titles.mjs after CSV rebuild (patches merged with CLEARABLE_FIELDS null-semantics for franchise/wishlist/manual_image_url; added re-appended; deletedIds tombstoned) — admin edits SURVIVE `npm run build`
  - enrich-tmdb.mjs skips ADMIN_OWNED_FIELDS (display_title, media_type, franchise, release_year, manual_image_url, genres, overview, tagline, vote_average, runtime, wishlist) for ids in overrides.patches
  - DELETE of admin-created title removes from `added`; DELETE of CSV title tombstones into `deletedIds` and clears its patch
- Frontend loads at runtime: `fetchTitles()` in `src/lib/data-adapter.ts`. Adapter now maps enrichment (overview→synopsis, genres, vote_average→rating, runtime, tagline), wishlist, copy condition. mock.ts has zero importers.
- Enrichment writes title-level match_status='unmatched' for ALL titles (upstream data quirk) — review queue therefore stays empty in practice.

## Admin Screen (src/screens/Admin.tsx)
- **Password gate**: `VITE_ADMIN_PASSWORD` (compile-time bake, typed in vite-env.d.ts) + sessionStorage key `mikflix.admin.unlocked`; unset = open in dev with hint; Lock button clears session
- Tabs: Inventory (searchable list + Add/Edit/Delete-with-confirm), Images (manual override manager), Review (uncertain queue)
- Title editor modal: core fields, tagline/synopsis, wishlist toggle+fields, multi-copy editor; payload built by buildPayload (ints parsed, empty→null)
- Admin API runs via Vite middleware (vite.config.ts plugin imports createAdminApiServer from scripts/admin-api.mjs; middleware must check `req.url.startsWith('/api/')` — mount-prefix `use('/api')` strips the prefix) or standalone `npm run admin:api` (port 4545)

## UI Notes
- `Poster` component: TMDb/manual `<img>` with onError → procedural canvas fallback; effect deps include showImage; canvas colors use hsla helpers; `wide` prop for 16:9
- Manual image priority: `manual_image_url ?? mapImageUrl(poster_path, w500)` in adapter
- `.btn`/`.btn--primary`/`.btn--ghost` styles live in home.css (Home-scoped); admin.css re-declares them scoped to `.admin` plus `.btn--danger`, gate/tabs/inv/ted/toast styles

## Git / Deployment
- Remote `origin` = github.com/thewoddlypenguin/mikflix. USER DRIVES ALL REMOTE OPS — never run git push/pull unless user explicitly asks; commit locally, hand over copy-paste instructions.
- Branch: main. Token (keyring service `workshop`, key GITHU1_GITHUB_TOKEN) is git-transport only (API 401); never echo token/remote URL.
- `.env` gitignored (NOT in repo; created from example with empty placeholders); `.env.example` has TMDB_API_KEY, TMDB_READ_TOKEN, VITE_ADMIN_PASSWORD, MIKFLIX_API_URL
- Windows quirks: use `uv`/npm via cmd; subprocess capture needs utf-8 decode with errors='replace' (cp1252 crashes on emoji); multiline `python -c` fails; cmd heredocs fail — use `git commit -F <tempfile>`; terminal output garbled — prefer execute tool subprocess or findstr
- NEVER build with `generate` unless you mean it: it overwrites the enriched titles.json; enrich re-applies from cache, and overrides.json re-applies admin edits. If a build fails after generate, `git checkout HEAD -- src/data/generated/titles.json public/titles.json` to restore.