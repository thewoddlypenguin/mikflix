// Mikflix — Admin API (zero-dependency node:http)
//
// Manual image overrides + full title CRUD for the Admin screen.
//
// Persistence: edits are written to BOTH titles.json copies AND a durable
// sidecar `data/admin/overrides.json`. The sidecar is what makes admin edits
// survive `npm run generate` (which rebuilds titles.json from the CSV):
// generate-titles.mjs re-applies patches / added titles / deletions after
// building from the seed, and enrich-tmdb.mjs leaves admin-owned fields
// (genres, overview, …) alone for patched titles.
//
// Endpoints:
//   GET    /api/titles                     → [{ id, title, manual_image_url, poster_path }]
//   GET    /api/title/:id                  → full raw title (for the editor)
//   POST   /api/title                      → create { title }              (body = raw title)
//   PUT    /api/title/:id                  → update { title }              (body = raw title)
//   DELETE /api/title/:id                  → tombstone (removes title)
//   POST   /api/manual-image               → { titleId, url }
//   POST   /api/manual-image/upload        → multipart (titleId, file) → public/images/
//   DELETE /api/manual-image?titleId=…     → clear image override
//
// In dev, vite.config.ts mounts this under /api (single origin). Standalone:
//   npm run admin:api   (port 4545, or ADMIN_API_PORT)

import { createServer } from 'node:http'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GENERATED_PATH = join(ROOT, 'src', 'data', 'generated', 'titles.json')
const PUBLIC_PATH = join(ROOT, 'public', 'titles.json')
const IMAGES_DIR = join(ROOT, 'public', 'images')
const OVERRIDES_DIR = join(ROOT, 'data', 'admin')
const OVERRIDES_PATH = join(OVERRIDES_DIR, 'overrides.json')

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8 MB

const PORT = Number(process.env.ADMIN_API_PORT) || 4545

// ─── storage helpers ───────────────────────────────────────────────────────

function readBundle() {
  return JSON.parse(readFileSync(GENERATED_PATH, 'utf8'))
}

function writeBundle(bundle) {
  bundle.generated_at = new Date().toISOString()
  const json = JSON.stringify(bundle, null, 2)
  writeFileSync(GENERATED_PATH, json, 'utf8')
  writeFileSync(PUBLIC_PATH, json, 'utf8')
}

/** shape: { patches: { [id]: {…fields} }, added: RawTitle[], deletedIds: string[] } */
function readOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return { patches: {}, added: [], deletedIds: [] }
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
    return {
      patches: raw.patches ?? {},
      added: raw.added ?? [],
      deletedIds: raw.deletedIds ?? [],
    }
  } catch {
    return { patches: {}, added: [], deletedIds: [] }
  }
}

function writeOverrides(ov) {
  mkdirSync(OVERRIDES_DIR, { recursive: true })
  writeFileSync(OVERRIDES_PATH, JSON.stringify(ov, null, 2), 'utf8')
}

// ─── title normalization ───────────────────────────────────────────────────

/** Fields the admin may edit on an existing (CSV-sourced) title. */
const EDITABLE_TITLE_FIELDS = [
  'display_title', 'media_type', 'franchise', 'release_year',
  'manual_image_url', 'genres', 'overview', 'tagline', 'vote_average', 'runtime',
  'wishlist', 'copies',
]

const EDITABLE_COPY_FIELDS = [
  'entry_id', 'season_set', 'part_volume', 'disc_start', 'disc_end', 'disc_count',
  'storage_type', 'container_name', 'slot_start', 'slot_end', 'location_detail',
  'format', 'label_raw', 'condition', 'match_status', 'match_confidence', 'notes',
]

function pick(obj, fields) {
  const out = {}
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f]
  }
  return out
}

function sanitizeCopies(copies) {
  if (!Array.isArray(copies)) return []
  return copies.map(c => pick(c, EDITABLE_COPY_FIELDS))
}

/** Recompute denormalized facets from the copies array (mirrors generate-titles.mjs). */
function recomputeDenorm(title) {
  const copies = title.copies ?? []
  title.copy_count = copies.length
  title.formats = [...new Set(copies.map(c => c.format).filter(Boolean))]
  title.storage_types = [...new Set(copies.map(c => c.storage_type).filter(Boolean))]
  title.season_sets = [...new Set(copies.map(c => c.season_set).filter(Boolean))]
  title.containers = [...new Set(copies.map(c => c.container_name).filter(Boolean))]
  return title
}

function slugify(title, year) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 48) + '-' + (year || 'unknown')
}

function uniqueId(base, existingIds) {
  if (!existingIds.has(base)) return base
  let n = 2
  while (existingIds.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// ─── http helpers ──────────────────────────────────────────────────────────

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolvePromise(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJsonBody(req) {
  const raw = (await readBody(req)).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

/** Minimal multipart/form-data parser — enough for one file + text fields. */
function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!m) return null
  const boundary = '--' + (m[1] || m[2])
  const parts = {}
  const boundaryBuf = Buffer.from(boundary)
  let start = buffer.indexOf(boundaryBuf)
  while (start !== -1) {
    const headStart = start + boundaryBuf.length + 2 // skip CRLF
    const headEnd = buffer.indexOf('\r\n\r\n', headStart)
    if (headEnd === -1) break
    const next = buffer.indexOf(boundaryBuf, headEnd)
    if (next === -1) break
    const head = buffer.slice(headStart, headEnd).toString('utf8')
    const body = buffer.slice(headEnd + 4, next - 2) // strip trailing CRLF
    const nameMatch = /name="([^"]*)"/i.exec(head)
    const fileMatch = /filename="([^"]*)"/i.exec(head)
    if (nameMatch) {
      parts[nameMatch[1]] = fileMatch
        ? { filename: fileMatch[1], data: body }
        : body.toString('utf8')
    }
    start = next
  }
  return parts
}

function extFromFilenameOrMime(filename, buffer) {
  const byExt = extname(filename || '').toLowerCase()
  if (ALLOWED_EXTENSIONS.has(byExt)) return byExt
  const b = buffer
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return '.jpg'
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return '.png'
  if (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return '.webp'
  if (b.length > 12 && b.slice(4, 8).toString() === 'ftyp') return '.avif'
  if (b.length > 6 && b.slice(0, 3).toString() === 'GIF') return '.gif'
  return null
}

function applyManualImage(bundle, ov, titleId, url) {
  const title = bundle.titles.find(t => t.id === titleId)
  if (!title) return null
  if (url) title.manual_image_url = url
  else delete title.manual_image_url
  // mirror into overrides patch so it survives regeneration
  ov.patches[titleId] = { ...(ov.patches[titleId] ?? {}), manual_image_url: url || null }
  if (!url) delete ov.patches[titleId].manual_image_url
  if (Object.keys(ov.patches[titleId]).length === 0) delete ov.patches[titleId]
  return title
}

// ─── request handler ───────────────────────────────────────────────────────

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  if (!path.startsWith('/api/')) {
    sendJson(res, 404, { error: 'not found' })
    return
  }

  // ---- GET /api/titles — lightweight list for pickers ---------------------
  if (req.method === 'GET' && path === '/api/titles') {
    const bundle = readBundle()
    sendJson(res, 200, bundle.titles.map(t => ({
      id: t.id,
      title: t.display_title,
      year: t.release_year,
      media_type: t.media_type,
      manual_image_url: t.manual_image_url ?? null,
      poster_path: t.poster_path ?? null,
    })))
    return
  }

  // ---- GET /api/title/:id — full raw title for the editor -----------------
  const titleMatch = /^\/api\/title\/([^/]+)$/.exec(path)
  if (req.method === 'GET' && titleMatch) {
    const bundle = readBundle()
    const title = bundle.titles.find(t => t.id === decodeURIComponent(titleMatch[1]))
    if (!title) { sendJson(res, 404, { error: 'unknown titleId' }); return }
    sendJson(res, 200, title)
    return
  }

  // ---- POST /api/title — create -------------------------------------------
  if (req.method === 'POST' && path === '/api/title') {
    const body = await readJsonBody(req)
    const displayTitle = String(body.display_title ?? '').trim()
    if (!displayTitle) { sendJson(res, 400, { error: 'display_title is required' }); return }
    const bundle = readBundle()
    const ov = readOverrides()
    const ids = new Set(bundle.titles.map(t => t.id))
    const id = uniqueId(slugify(displayTitle, body.release_year), ids)

    const title = {
      id,
      ...pick(body, EDITABLE_TITLE_FIELDS.filter(f => f !== 'copies')),
      copies: sanitizeCopies(body.copies),
    }
    title.display_title = displayTitle
    title.tmdb_id = body.tmdb_id ?? null
    title.tmdb_media_type = body.tmdb_media_type ?? null
    title.poster_path = body.poster_path ?? null
    title.backdrop_path = body.backdrop_path ?? null
    title.match_status = body.match_status ?? 'confirmed'
    title.match_confidence = body.match_confidence ?? 'high'
    title.art_seed = id
    title.art_hue = body.art_hue ?? Math.abs([...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) & 0xffffffff, 0)) % 360
    title.art_motif = body.art_motif ?? 'ring'
    recomputeDenorm(title)

    bundle.titles.push(title)
    bundle.titles.sort((a, b) => {
      const order = { tv: 0, music: 1, movie: 2 }
      if (a.media_type !== b.media_type) return (order[a.media_type] ?? 9) - (order[b.media_type] ?? 9)
      return a.display_title.localeCompare(b.display_title)
    })
    ov.added.push(JSON.parse(JSON.stringify(title)))
    writeBundle(bundle)
    writeOverrides(ov)
    sendJson(res, 201, { ok: true, title })
    return
  }

  // ---- PUT /api/title/:id — update ----------------------------------------
  if (req.method === 'PUT' && titleMatch) {
    const id = decodeURIComponent(titleMatch[1])
    const body = await readJsonBody(req)
    const bundle = readBundle()
    const ov = readOverrides()
    const title = bundle.titles.find(t => t.id === id)
    if (!title) { sendJson(res, 404, { error: `unknown titleId: ${id}` }); return }

    Object.assign(title, pick(body, EDITABLE_TITLE_FIELDS.filter(f => f !== 'copies')))
    if (body.copies !== undefined) title.copies = sanitizeCopies(body.copies)
    if (body.wishlist === null) delete title.wishlist
    if (title.manual_image_url === null) delete title.manual_image_url
    recomputeDenorm(title)

    // durable override patch (editable fields only; copies sanitized)
    const patch = pick(title, EDITABLE_TITLE_FIELDS.filter(f => f !== 'copies' && f !== 'manual_image_url'))
    patch.copies = JSON.parse(JSON.stringify(title.copies))
    if (title.wishlist === undefined) patch.wishlist = null
    ov.patches[id] = patch

    // keep the added-title copy in sync if this was an admin-created title
    const addedIdx = ov.added.findIndex(t => t.id === id)
    if (addedIdx !== -1) ov.added[addedIdx] = JSON.parse(JSON.stringify(title))

    writeBundle(bundle)
    writeOverrides(ov)
    sendJson(res, 200, { ok: true, title })
    return
  }

  // ---- DELETE /api/title/:id — tombstone ----------------------------------
  if (req.method === 'DELETE' && titleMatch) {
    const id = decodeURIComponent(titleMatch[1])
    const bundle = readBundle()
    const ov = readOverrides()
    const idx = bundle.titles.findIndex(t => t.id === id)
    if (idx === -1) { sendJson(res, 404, { error: `unknown titleId: ${id}` }); return }

    bundle.titles.splice(idx, 1)
    const addedIdx = ov.added.findIndex(t => t.id === id)
    if (addedIdx !== -1) {
      // admin-created title: remove from added list
      ov.added.splice(addedIdx, 1)
      delete ov.patches[id]
    } else {
      // CSV-sourced title: tombstone so `generate` doesn't resurrect it
      if (!ov.deletedIds.includes(id)) ov.deletedIds.push(id)
      delete ov.patches[id]
    }
    writeBundle(bundle)
    writeOverrides(ov)
    sendJson(res, 200, { ok: true, deleted: id })
    return
  }

  // ---- POST /api/manual-image (set by URL) --------------------------------
  if (req.method === 'POST' && path === '/api/manual-image') {
    const body = await readJsonBody(req)
    const { titleId, url: imageUrl } = body
    if (!titleId || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      sendJson(res, 400, { error: 'titleId and url are required' })
      return
    }
    const trimmed = imageUrl.trim()
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
      sendJson(res, 400, { error: 'url must be http(s) or a site-relative /path' })
      return
    }
    const bundle = readBundle()
    const ov = readOverrides()
    if (!applyManualImage(bundle, ov, titleId, trimmed)) {
      sendJson(res, 404, { error: `unknown titleId: ${titleId}` })
      return
    }
    writeBundle(bundle)
    writeOverrides(ov)
    sendJson(res, 200, { ok: true, titleId, manual_image_url: trimmed })
    return
  }

  // ---- POST /api/manual-image/upload (set by file) ------------------------
  if (req.method === 'POST' && path === '/api/manual-image/upload') {
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      sendJson(res, 400, { error: 'expected multipart/form-data' })
      return
    }
    const parts = parseMultipart(await readBody(req), contentType)
    if (!parts?.titleId || !parts?.file?.data) {
      sendJson(res, 400, { error: 'titleId and file are required' })
      return
    }
    const ext = extFromFilenameOrMime(parts.file.filename, parts.file.data)
    if (!ext) {
      sendJson(res, 400, { error: 'unsupported image type (jpg, png, webp, avif, gif)' })
      return
    }
    const bundle = readBundle()
    const ov = readOverrides()
    const title = bundle.titles.find(t => t.id === parts.titleId)
    if (!title) {
      sendJson(res, 404, { error: `unknown titleId: ${parts.titleId}` })
      return
    }
    mkdirSync(IMAGES_DIR, { recursive: true })
    const safeBase = title.id.replace(/[^a-z0-9-]/gi, '_').slice(0, 64)
    const filename = `${safeBase}-${randomBytes(4).toString('hex')}${ext}`
    writeFileSync(join(IMAGES_DIR, filename), parts.file.data)
    const sitePath = `/images/${filename}`
    applyManualImage(bundle, ov, title.id, sitePath)
    writeBundle(bundle)
    writeOverrides(ov)
    sendJson(res, 200, { ok: true, titleId: title.id, manual_image_url: sitePath })
    return
  }

  // ---- DELETE /api/manual-image -------------------------------------------
  if (req.method === 'DELETE' && path === '/api/manual-image') {
    const titleId = url.searchParams.get('titleId')
    if (!titleId) {
      sendJson(res, 400, { error: 'titleId query param required' })
      return
    }
    const bundle = readBundle()
    const ov = readOverrides()
    if (!applyManualImage(bundle, ov, titleId, null)) {
      sendJson(res, 404, { error: `unknown titleId: ${titleId}` })
      return
    }
    writeBundle(bundle)
    writeOverrides(ov)
    sendJson(res, 200, { ok: true, titleId, manual_image_url: null })
    return
  }

  sendJson(res, 404, { error: 'unknown endpoint' })
}

export function createAdminApiServer() {
  return createServer((req, res) => {
    handle(req, res).catch(err => {
      console.error('admin API error:', err.message)
      if (!res.headersSent) sendJson(res, 500, { error: err.message })
    })
  })
}

// Run directly (node scripts/admin-api.mjs) — not when imported by Vite
const invoked = process.argv[1]?.replace(/\\/g, '/').split('/').pop()
if (invoked === 'admin-api.mjs') {
  createAdminApiServer().listen(PORT, () => {
    console.log(`🗝  admin API on http://localhost:${PORT}`)
    console.log(`   writes: ${GENERATED_PATH}`)
    console.log(`         + ${PUBLIC_PATH}`)
    console.log(`         + ${OVERRIDES_PATH}`)
    console.log(`   uploads → ${IMAGES_DIR}`)
  })
}
