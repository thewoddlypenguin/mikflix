import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TITLES_PATH     = join(ROOT, 'src', 'data', 'generated', 'titles.json')
const PUBLIC_PATH     = join(ROOT, 'public', 'titles.json')
const CACHE_PATH      = join(__dirname, 'tmdb-cache.json')
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const RATE_LIMIT_MS   = 250  // ~4 req/s, well under TMDb 40 req/10s limit

// ---------------------------------------------------------------------------
// Auth — prefer bearer token (v4), fall back to API key (v3)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return {}
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = loadEnv()
const BEARER_TOKEN = env.TMDB_READ_TOKEN || process.env.TMDB_READ_TOKEN || ''
const API_KEY      = env.TMDB_API_KEY    || process.env.TMDB_API_KEY    || ''

// Warm the cache before the credential check so a cold clone (no .env) can
// still rebuild fully from the committed cache without network access.
const warmCache = loadCache()
const warmCacheable = (titlesJsonPath) => {
  if (!existsSync(titlesJsonPath)) return 0
  try {
    const bundle = JSON.parse(readFileSync(titlesJsonPath, 'utf8'))
    return bundle.titles.filter(t => {
      if (t.media_type === 'music') return true // always skipped
      const key = t.tmdb_id
        ? `details:${t.tmdb_media_type}:${t.tmdb_id}`
        : `search:${t.id}`
      return Boolean(warmCache[key]?.enrichment)
    }).length
  } catch { return 0 }
}

if (!BEARER_TOKEN && !API_KEY && warmCacheable(TITLES_PATH) === 0) {
  console.error('❌  No TMDb credentials found and cache cannot cover the bundle.')
  console.error('    Set TMDB_READ_TOKEN or TMDB_API_KEY in .env, then re-run.')
  process.exit(1)
}
if (!BEARER_TOKEN && !API_KEY) {
  console.warn('⚠️  No TMDb credentials — running from cache only; titles missing')
  console.warn('    cache entries will be left un-enriched (no network calls).')
}

function authHeaders() {
  if (BEARER_TOKEN) return { Authorization: `Bearer ${BEARER_TOKEN}` }
  return {}
}

function buildUrl(path, params = {}) {
  const base = `https://api.themoviedb.org/3${path}`
  const p = new URLSearchParams(params)
  if (!BEARER_TOKEN) p.set('api_key', API_KEY)
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

// ---------------------------------------------------------------------------
// Rate-limited fetch
// ---------------------------------------------------------------------------
async function tmdbFetch(path, params = {}) {
  const url = buildUrl(path, params)
  const res = await fetch(url, { headers: { ...authHeaders(), Accept: 'application/json' } })
  if (!res.ok) {
    if (res.status === 429) {
      const retry = parseInt(res.headers.get('Retry-After') || '5', 10)
      console.warn(`  ⏳ Rate limited — waiting ${retry}s`)
      await sleep(retry * 1000)
      return tmdbFetch(path, params)
    }
    throw new Error(`TMDb ${res.status} for ${path}`)
  }
  return res.json()
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
function loadCache() {
  if (!existsSync(CACHE_PATH)) return {}
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) } catch { return {} }
}

function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8')
}

// ---------------------------------------------------------------------------
// TMDb helpers
// ---------------------------------------------------------------------------

// Strip season/part suffixes for cleaner search queries
function cleanSearchTitle(displayTitle) {
  return displayTitle
    .replace(/:\s*(season|series|part|volume|collection|set|complete)\s*[\d\w]*/gi, '')
    .replace(/\s+(season|series|part|volume)\s+[\d\w]+$/gi, '')
    .trim()
}

async function searchTmdb(title, year, mediaType) {
  const query = cleanSearchTitle(title)
  const endpoint = mediaType === 'tv' ? '/search/tv' : '/search/movie'
  const params = { query, language: 'en-US', page: '1' }
  if (year && year > 0) {
    if (mediaType === 'tv') params.first_air_date_year = String(year)
    else params.year = String(year)
  }

  let data = await tmdbFetch(endpoint, params)

  // Retry without year if no results
  if ((!data.results || data.results.length === 0) && year && year > 0) {
    delete params.year
    delete params.first_air_date_year
    data = await tmdbFetch(endpoint, params)
  }

  // Fallback: try opposite media type
  if (!data.results || data.results.length === 0) {
    const fallback = mediaType === 'tv' ? '/search/movie' : '/search/tv'
    data = await tmdbFetch(fallback, { query, language: 'en-US', page: '1' })
  }

  return data.results || []
}

async function fetchDetails(tmdbId, tmdbMediaType) {
  const endpoint = tmdbMediaType === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`
  return tmdbFetch(endpoint, { language: 'en-US' })
}

function pickBestResult(results, displayTitle, year) {
  if (!results.length) return null

  const cleanQuery = cleanSearchTitle(displayTitle).toLowerCase()

  const scored = results.map(r => {
    const rTitle = (r.title || r.name || '').toLowerCase()
    const rYear  = parseInt(r.release_date?.slice(0, 4) || r.first_air_date?.slice(0, 4) || '0', 10)
    let score = 0

    if (rTitle === cleanQuery) score += 10
    else if (rTitle.includes(cleanQuery) || cleanQuery.includes(rTitle)) score += 5

    if (year && year > 0 && rYear > 0) {
      const diff = Math.abs(rYear - year)
      if (diff === 0) score += 5
      else if (diff <= 1) score += 2
    }

    score += Math.min((r.popularity || 0) / 100, 2)
    return { result: r, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].score > 0 ? scored[0].result : results[0]
}

function extractEnrichment(details, tmdbMediaType) {
  return {
    overview:      details.overview || null,
    vote_average:  details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
    vote_count:    details.vote_count || null,
    genres:        (details.genres || []).map(g => g.name),
    poster_path:   details.poster_path || null,
    backdrop_path: details.backdrop_path || null,
    tagline:       details.tagline || null,
    ...(tmdbMediaType === 'tv' ? {
      number_of_seasons:  details.number_of_seasons || null,
      number_of_episodes: details.number_of_episodes || null,
      status:             details.status || null,
    } : {
      runtime: details.runtime || null,
    }),
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🎬 TMDb Enrichment Script')
  console.log('─'.repeat(50))

  if (!existsSync(TITLES_PATH)) {
    console.error(`❌  titles.json not found. Run \`npm run generate\` first.`)
    process.exit(1)
  }

  const bundle = JSON.parse(readFileSync(TITLES_PATH, 'utf8'))
  const titles = bundle.titles
  console.log(`📚 Loaded ${titles.length} titles`)

  const cache = loadCache()
  console.log(`💾 Cache: ${Object.keys(cache).length} entries`)

  let enriched = 0, skipped = 0, failed = 0, fromCache = 0

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]
    const label = `[${i + 1}/${titles.length}] ${title.display_title}`

    const cacheKey = title.tmdb_id
      ? `details:${title.tmdb_media_type}:${title.tmdb_id}`
      : `search:${title.id}`

    // Serve from cache if available
    if (cache[cacheKey]?.enrichment) {
      Object.assign(title, cache[cacheKey].enrichment, {
        tmdb_id:         cache[cacheKey].tmdb_id ?? title.tmdb_id,
        tmdb_media_type: cache[cacheKey].tmdb_media_type ?? title.tmdb_media_type,
      })
      fromCache++
      process.stdout.write(`  ✓ ${label} (cached)\n`)
      continue
    }

    // Skip music — TMDb doesn't cover physical music well
    if (title.media_type === 'music') {
      skipped++
      process.stdout.write(`  ⏭  ${label} (music — skipped)\n`)
      continue
    }

    try {
      let tmdbId        = title.tmdb_id
      let tmdbMediaType = title.tmdb_media_type || title.media_type

      if (!tmdbId) {
        if (!BEARER_TOKEN && !API_KEY) {
          // Offline: no credentials and no cached search result for this title
          process.stdout.write(`  ↩  ${label} (offline — no cached match, left un-enriched)\n`)
          continue
        }
        process.stdout.write(`  🔍 ${label}...\n`)
        await sleep(RATE_LIMIT_MS)

        const results = await searchTmdb(title.display_title, title.release_year, title.media_type)
        const best    = pickBestResult(results, title.display_title, title.release_year)

        if (!best) {
          console.warn(`  ⚠️  No match: ${title.display_title}`)
          cache[cacheKey] = { enrichment: null, searched_at: new Date().toISOString() }
          failed++
          continue
        }

        tmdbId        = best.id
        tmdbMediaType = best.title ? 'movie' : 'tv'
        process.stdout.write(`     → "${best.title || best.name}" (${best.release_date || best.first_air_date || 'n/a'}) id:${tmdbId}\n`)
      } else {
        if (!warmCache[cacheKey]?.enrichment && !BEARER_TOKEN && !API_KEY) {
          process.stdout.write(`  ↩  ${label} (offline — details not cached, left as-is)\n`)
          continue
        }
        process.stdout.write(`  📋 ${label} (id:${tmdbId})...\n`)
      }

      await sleep(RATE_LIMIT_MS)
      const details    = await fetchDetails(tmdbId, tmdbMediaType)
      const enrichment = extractEnrichment(details, tmdbMediaType)

      title.tmdb_id         = tmdbId
      title.tmdb_media_type = tmdbMediaType
      Object.assign(title, enrichment)

      const detailKey       = `details:${tmdbMediaType}:${tmdbId}`
      cache[detailKey]      = { tmdb_id: tmdbId, tmdb_media_type: tmdbMediaType, enrichment, cached_at: new Date().toISOString() }
      cache[cacheKey]       = cache[detailKey]

      enriched++
    } catch (err) {
      console.error(`  ❌ "${title.display_title}": ${err.message}`)
      failed++
    }
  }

  saveCache(cache)

  console.log('\n' + '─'.repeat(50))
  console.log(`✅ Done — enriched: ${enriched} | cached: ${fromCache} | skipped: ${skipped} | failed: ${failed}`)

  bundle.schema          = '1.2.0'
  bundle.generated_at    = new Date().toISOString()
  bundle.tmdb_image_base = TMDB_IMAGE_BASE

  const outJson = JSON.stringify(bundle, null, 2)
  writeFileSync(TITLES_PATH, outJson, 'utf8')
  writeFileSync(PUBLIC_PATH, outJson, 'utf8')
  console.log(`\n📝 Wrote titles.json (schema 1.2.0)`)
  console.log(`   Posters  : ${TMDB_IMAGE_BASE}/w500{poster_path}`)
  console.log(`   Backdrops: ${TMDB_IMAGE_BASE}/w1280{backdrop_path}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })