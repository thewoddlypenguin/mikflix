# Project: Mikflix (My Movie Database)

Personal physical-media collection browser ("Mikflix"). Phase: front-end app shell, MOCK DATA only (no DB/TMDb/import yet).

## Stack & Conventions
- Vite + React 19 + TypeScript + react-router v7 (library package: `react-router`, imports from `react-router`)
- Deps: motion, lucide-react. Node 22 / npm 10, Windows shell (no `tail`; use `findstr`)
- Run: `start.bat` / `start.sh` (uses $APP_PORT) · Build: `npm run build` (tsc -b + vite)
- tsconfig is strict with noUnusedLocals/Parameters — unused imports fail the build

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

## Deployment
User will push to GitHub themselves — do not deploy; keep `base: './'` in vite.config for static hosting.