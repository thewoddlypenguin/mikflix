import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const headers = splitCSVLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = splitCSVLine(line)
    const row = {}
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

function splitCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += ch }
  }
  result.push(current)
  return result
}

function normalizeKey(title) {
  return title.toLowerCase().replace(/^(the|a|an)\s+/i, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function mapFormat(raw) {
  const f = (raw ?? '').toLowerCase().trim()
  if (f === '4k uhd' || f === 'uhd' || f === '4k') return '4K UHD'
  if (f === 'blu-ray' || f === 'bluray') return 'Blu-ray'
  if (f === 'digital' || f === 'hd' || f === 'hdx' || f === 'sd') return 'Digital'
  if (f === 'vhs') return 'VHS'
  return 'DVD'
}

function mapStorageType(raw) {
  const s = (raw ?? '').toLowerCase().trim()
  if (s === 'digital') return 'digital'
  if (s === 'drawer') return 'drawer'
  if (s === 'binder') return 'binder'
  if (s === 'discgear') return 'shelf'
  return 'shelf'
}

function mapMediaType(raw) {
  const m = (raw ?? '').toLowerCase().trim()
  if (m === 'tv' || m === 'series') return 'tv'
  if (m === 'music') return 'music'
  return 'movie'
}

function mapMatchStatus(raw) {
  if (raw === 'confirmed') return 'confirmed'
  if (raw === 'uncertain') return 'uncertain'
  if (raw === 'unmatched') return 'unmatched'
  return 'confirmed'
}

function mapMatchConfidence(raw) {
  const n = parseFloat(raw)
  if (!isNaN(n)) {
    if (n >= 0.9) return 'high'
    if (n >= 0.6) return 'medium'
    return 'low'
  }
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw
  return 'high'
}

function slugify(title, year) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 48) + '-' + (year || 'unknown')
}

function deterministicHue(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
  return Math.abs(hash) % 360
}

const MOTIFS = ['ring', 'arch', 'horizon', 'emblem', 'mono']
function deterministicMotif(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 17 + str.charCodeAt(i)) & 0xffffffff
  return MOTIFS[Math.abs(hash) % MOTIFS.length]
}

const csvPath = join(ROOT, 'src', 'data', 'digital-inventory-batch-1.csv')
const outDir  = join(ROOT, 'src', 'data', 'generated')
const outPath = join(outDir, 'titles.json')

console.log('Reading CSV:', csvPath)
const raw = readFileSync(csvPath, 'utf8')
const rows = parseCSV(raw)
console.log(`Parsed ${rows.length} rows`)

const titleMap = new Map()

for (const row of rows) {
  const displayTitle = (row['title_display'] || '').trim()
  if (!displayTitle) continue

  const year = parseInt(row['release_year'] || '0', 10) || 0
  const key = normalizeKey(displayTitle) + '-' + year

  if (!titleMap.has(key)) {
    titleMap.set(key, {
      displayTitle,
      year,
      mediaType: mapMediaType(row['media_type'] || 'movie'),
      franchise: (row['franchise'] || '').trim() || null,
      tmdbId: (row['tmdb_id'] || '').trim() || null,
      tmdbMediaType: (row['tmdb_media_type'] || '').trim() || null,
      posterPath: (row['poster_path'] || '').trim() || null,
      copies: [],
    })
  }

  const entry = titleMap.get(key)

  // Keep first non-empty tmdb/poster data found across copies
  if (!entry.tmdbId && row['tmdb_id']) entry.tmdbId = row['tmdb_id'].trim()
  if (!entry.posterPath && row['poster_path']) entry.posterPath = row['poster_path'].trim()

  entry.copies.push({
    entry_id:         (row['entry_id'] || '').trim() || null,
    season_set:       (row['season_set'] || '').trim() || null,
    part_volume:      (row['part_volume'] || '').trim() || null,
    disc_start:       parseInt(row['disc_start'] || '', 10) || null,
    disc_end:         parseInt(row['disc_end'] || '', 10) || null,
    disc_count:       parseInt(row['disc_count'] || '', 10) || null,
    storage_type:     mapStorageType(row['storage_type'] || ''),
    container_name:   (row['container_name'] || '').trim() || null,
    slot_start:       parseInt(row['slot_start'] || '', 10) || null,
    slot_end:         parseInt(row['slot_end'] || '', 10) || null,
    location_detail:  (row['location_detail'] || '').trim() || null,
    format:           mapFormat(row['format'] || ''),
    label_raw:        (row['label_raw'] || '').trim() || null,
    match_status:     mapMatchStatus(row['title_match_status'] || ''),
    match_confidence: mapMatchConfidence(row['match_confidence'] || ''),
    notes:            (row['notes'] || '').trim() || null,
  })
}

console.log(`Grouped into ${titleMap.size} unique titles`)

const titles = []
for (const [, entry] of titleMap) {
  const id = slugify(entry.displayTitle, entry.year)
  titles.push({
    id,
    display_title:    entry.displayTitle,
    media_type:       entry.mediaType,
    franchise:        entry.franchise,
    release_year:     entry.year,
    tmdb_id:          entry.tmdbId,
    tmdb_media_type:  entry.tmdbMediaType,
    poster_path:      entry.posterPath,
    match_status:     entry.copies[0]?.match_status ?? 'confirmed',
    match_confidence: entry.copies[0]?.match_confidence ?? 'high',
    copy_count:       entry.copies.length,
    formats:          [...new Set(entry.copies.map(c => c.format))],
    storage_types:    [...new Set(entry.copies.map(c => c.storage_type))],
    season_sets:      [...new Set(entry.copies.map(c => c.season_set).filter(Boolean))],
    containers:       [...new Set(entry.copies.map(c => c.container_name).filter(Boolean))],
    copies:           entry.copies,
    art_seed:         id,
    art_hue:          deterministicHue(id),
    art_motif:        deterministicMotif(id),
  })
}

titles.sort((a, b) => {
  const order = { tv: 0, music: 1, movie: 2 }
  if (a.media_type !== b.media_type) return (order[a.media_type] ?? 9) - (order[b.media_type] ?? 9)
  return a.display_title.localeCompare(b.display_title)
})

mkdirSync(outDir, { recursive: true })
const bundle = { schema: '1.1.0', generated_at: new Date().toISOString(), titles }
const bundleJson = JSON.stringify(bundle, null, 2)
writeFileSync(outPath, bundleJson, 'utf8')
console.log(`✅ Wrote ${titles.length} titles to ${outPath}`)

// Mirror the bundle to public/ so `vite dev` and `vite build` both serve
// /titles.json without a post-build copy step.
const publicDir = join(ROOT, 'public')
mkdirSync(publicDir, { recursive: true })
writeFileSync(join(publicDir, 'titles.json'), bundleJson, 'utf8')
console.log(`✅ Mirrored to ${join(publicDir, 'titles.json')}`)

const digital  = titles.filter(t => t.storage_types.includes('digital')).length
const both     = titles.filter(t => t.storage_types.includes('digital') && t.storage_types.length > 1).length
console.log(`   📀 Physical only : ${titles.length - digital}`)
console.log(`   💻 Digital only  : ${digital - both}`)
console.log(`   🔀 Both locations: ${both}`)
