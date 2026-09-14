# Plan: Personal Physical Media Library — App Shell (Mock Data Phase)

## Goal
Production-minded front-end app shell for browsing a personal physical media
collection (movies / TV / music-concert discs, box sets, binder discs, wishlist).
Mock data only. No DB / TMDb / import logic.

## Stack
- Vite + React 19 + TypeScript
- react-router v7 (routes: /, /library, /title/:titleId, /wishlist, /admin)
- motion (micro-interactions / reveals), lucide-react (icons)
- Google Fonts: Fraunces (display), Karla (UI), IBM Plex Mono (locations/meta)

## Aesthetic
"Warm midnight projection booth" — cinematic dark lounge: deep espresso
background, amber-gold accent (owned), teal (wishlist/wanted), parchment text,
film-grain atmosphere, poster-led browsing. NOT a streaming clone, NOT SaaS.

## Structure
```
src/
  data/types.ts, mock.ts, categories.ts
  lib/collection.ts (selectors/filtering/sorting), format.ts
  components/ui/ Badge, Chip, Poster (procedural poster art), ToggleGroup,
                 EmptyState, SectionHeading, Reveal
  components/layout/ AppShell, Header, Footer
  components/collection/ TitleCard, CopyCard, WishlistCard, CollectionRow
  components/library/ FilterDrawer, FilterChipBar, SortMenu, ViewToggle
  screens/ Home, Library, TitleDetail, Wishlist, Admin
```

## Core behaviors
- Grouped-titles vs individual-copies toggle in Library (copyCount > 1 handled)
- Badge system: Owned, Box Set, Binder Disc, Loose Disc Only, Wishlist,
  Upgrade Wanted, Replacement Wanted, Complete Series, Uncertain Match
- Header search routes to /library with query context
- Filter facets derived from mock data; active chips removable
- Title detail: Watch Info / Ownership Info / Collector Actions sections
- Wishlist groups: Want to Buy, Replace Lost Copy, Upgrade Edition, Missing Box

## Mock dataset
18–20 recognizable titles covering: single-copy, multi-copy, loose-disc-only,
complete series, box sets, wishlist-only, upgrade-wanted, replace-lost,
missing-box, duplicates, uncertain-match, music/concert.

## Out of scope
DB, spreadsheet import, TMDb, dedupe logic, real deployment (user will push
to GitHub themselves).

## Deliverable
Interactive app shell verified with `npm run build` + dev-server smoke test,
start script, git initialized with clean commits.